// Настройки: аккаунт, синхронизация, уведомления, оформление,
// ёмкость дня, первый день недели, категории, теги, экспорт и импорт.
// Все правки идут через profile.ts: Dexie + outbox, сеть догоняет в фоне.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { db } from '../data/db'
import type { TaskRow } from '../data/contract'
import { useLive } from '../data/hooks'
import { supabase } from '../data/supabase'
import { pullSince, useSyncStatus, type SyncStatus, retryFailedOutbox, discardFailedOutbox } from '../data/sync'
import { bulkInsertTasks, softDeleteTask } from '../data/repo'
import { deleteTag, exportJson, updateCategory, updateProfile } from '../data/profile'
import { demoMode } from '../app/session'
import { useTheme } from '../app/theme'
import { themeById } from '../domain/themes'
import type { CategoryRow } from '../data/contract'
import type { DateStr } from '../domain/types'
import { CategoryIcon, IconChevronRight } from '../ui/icons'
import { plural, relativeTime } from '../ui/format'

// Держать в согласии с package.json: единственное место, где версия видна глазами.
const APP_VERSION = '0.1.0'

/** Пределы ёмкости дня: от 2 до 16 строк борда, шаг — строка мелочи. */
const CAPACITY_MIN = 8
const CAPACITY_MAX = 64
const CAPACITY_STEP = 4

const BTN_COMPACT = 'flex h-8 shrink-0 items-center rounded-tile bg-surface2 px-3 text-13'

function syncCaption(s: SyncStatus): string {
  if (s.state === 'offline') return 'нет сети'
  if (s.failed > 0) return `ошибка · ${s.failed} застряло`
  if (s.pending > 0)
    return `${s.pending} ${plural(s.pending, 'изменение', 'изменения', 'изменений')} в очереди`
  return s.lastPulledAt ? `всё отправлено · ${relativeTime(s.lastPulledAt)}` : 'всё отправлено'
}

export function SettingsScreen({
  userId,
  today,
  onOpenNotifications,
  onOpenTheme,
}: {
  userId: string
  today: DateStr
  onOpenNotifications: () => void
  onOpenTheme: () => void
}) {
  const profile = useLive(() => db.profiles.get(userId), [userId])
  const categories = useLive(() => db.categories.orderBy('sort_order').toArray(), [userId])
  const tags = useLive(() => db.tags.orderBy('name').toArray(), [userId])
  const subs = useLive(() => db.push_subscriptions.toArray(), [userId])
  const sync = useSyncStatus()
  const { activeId } = useTheme()

  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => {
    if (demoMode || !supabase) return
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  // Активные категории по sort_order, архивные хвостом — их видно, но они не мешают.
  const userCats = (categories ?? []).filter((c) => c.user_id === userId)
  const sortedCats = [...userCats.filter((c) => !c.archived_at), ...userCats.filter((c) => c.archived_at)]
  const userTags = (tags ?? []).filter((t) => t.user_id === userId)
  const subCount = (subs ?? []).filter((s) => s.user_id === userId).length

  const capacity = profile?.day_capacity ?? 32
  const weekStart = profile?.week_starts_on ?? 1
  const theme = themeById(activeId)

  // --- Экспорт ---------------------------------------------------------

  async function download(): Promise<void> {
    const blob = await exportJson(userId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `planner-${today}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // --- Импорт из Google Takeout ------------------------------------------

  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  // Tasks.json из Google Takeout. Реальный формат: items[].items[] с полями
  // title, status (needsAction|completed), created/updated/completed (ISO),
  // scheduled_time: [{start: ISO}], starred, notes, task_recurrence_id.
  // Парсим мягко: незнакомое игнорируем, записи без заголовка пропускаем.
  async function importTakeout(file: File): Promise<void> {
    setImporting(true)
    setImportResult(null)
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const lists = (parsed as { items?: unknown }).items
      if (!Array.isArray(lists)) {
        setImportResult('В файле нет списков задач — нужен Tasks.json из выгрузки Takeout')
        return
      }

      // Повторный импорт заменяет прошлый: мягко удаляем задачи без дня и без
      // шаблона — и открытые, и выполненные (свои живут на бордах с датой).
      const stale = await db.tasks
        .filter((t) => t.user_id === userId && t.scheduled_on === null && t.template_id === null && !t.deleted_at)
        .toArray()
      for (const t of stale) await softDeleteTask(t.id)

      const nowTs = new Date().toISOString()
      const rows: TaskRow[] = []
      let toDays = 0
      let toInbox = 0
      let doneCount = 0
      for (const list of lists) {
        const items = (list as { items?: unknown }).items
        if (!Array.isArray(items)) continue
        for (const raw of items) {
          const item = raw as Record<string, unknown>
          const title = typeof item['title'] === 'string' ? item['title'].trim() : ''
          if (!title) continue

          const sched = item['scheduled_time']
          const start =
            Array.isArray(sched) && sched.length > 0
              ? (sched[0] as Record<string, unknown>)['start']
              : null
          const date =
            typeof start === 'string' && /^\d{4}-\d{2}-\d{2}/.test(start) ? start.slice(0, 10) : null
          const timeRaw = typeof start === 'string' ? start.slice(11, 16) : ''
          const time = date && timeRaw && timeRaw !== '00:00' ? timeRaw : null

          const notes = item['notes']
          const created = typeof item['created'] === 'string' ? item['created'] : nowTs
          const done = item['status'] === 'completed'
          const completed = typeof item['completed'] === 'string' ? item['completed'] : null

          rows.push({
            id: crypto.randomUUID(),
            user_id: userId,
            title: title.slice(0, 200),
            note: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
            importance: item['starred'] ? 3 : 2,
            urgency_manual: 1,
            // Срок и план — из даты выгрузки: борд и цвета оживают сразу.
            due_on: done ? null : date,
            due_time: done ? null : time,
            remind_before: [],
            scheduled_on: date ?? (done && completed ? completed.slice(0, 10) : null),
            category_id: null,
            template_id: null,
            occurrence_on: null,
            order_index: rows.length,
            status: done ? 'done' : 'open',
            completed_at: done ? (completed ?? created) : null,
            urgency_at_completion: null,
            created_at: created,
            updated_at: nowTs,
            deleted_at: null,
          })
          if (done) doneCount++
          else if (date) toDays++
          else toInbox++
        }
      }

      await bulkInsertTasks(rows)
      setImportResult(
        rows.length === 0
          ? 'В файле не нашлось задач'
          : `Перенесено ${rows.length}: ${toDays} по дням, ${toInbox} в инбокс, ${doneCount} выполненных в историю`,
      )
    } catch {
      setImportResult('Не получилось разобрать файл — нужен Tasks.json из выгрузки Takeout')
    } finally {
      setImporting(false)
    }
  }


  return (
    <div className="flex h-full flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="shrink-0 px-3 pb-2 pt-1.5">
        <h1 className="font-tile text-24 font-semibold leading-[1.1] text-text">Настройки</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-6">
        <Group>
          <Row
            title={demoMode ? 'демо' : (email ?? '…')}
            caption={demoMode ? 'без входа, данные локальные' : 'вход по ссылке на почту'}
          >
            <button
              type="button"
              disabled={demoMode || !supabase}
              onClick={() => void supabase?.auth.signOut()}
              className={`${BTN_COMPACT} ${demoMode || !supabase ? 'text-text-quiet' : 'text-text'}`}
            >
              Выйти
            </button>
          </Row>

          <Row title="Синхронизация" caption={syncCaption(sync)}>
            {sync.failed > 0 ? (
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => void retryFailedOutbox()}
                  className={`${BTN_COMPACT} text-text`}
                >
                  Повторить
                </button>
                <button
                  type="button"
                  onClick={() => void discardFailedOutbox()}
                  className={`${BTN_COMPACT} text-text-muted`}
                >
                  Выбросить
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={demoMode || !supabase}
                onClick={() => void pullSince(userId)}
                className={`${BTN_COMPACT} ${demoMode || !supabase ? 'text-text-quiet' : 'text-text'}`}
              >
                Обновить
              </button>
            )}
          </Row>

          <Row
            title="Уведомления"
            caption={
              subCount > 0
                ? `разрешены · ${subCount} ${plural(subCount, 'устройство', 'устройства', 'устройств')}`
                : 'не настроены'
            }
            onPress={onOpenNotifications}
          >
            <IconChevronRight size={14} className="shrink-0 text-text-quiet" />
          </Row>

          <Row
            title="Оформление"
            caption={theme ? `${theme.name} · ${theme.kind === 'light' ? 'светлая' : 'тёмная'}` : activeId}
            onPress={onOpenTheme}
          >
            <IconChevronRight size={14} className="shrink-0 text-text-quiet" />
          </Row>
        </Group>

        <Group label="План">
          <Row title="Ёмкость дня" caption="сколько ячеек помещается в день">
            <span className="flex shrink-0 items-center gap-1">
              <StepButton
                label="Уменьшить ёмкость"
                disabled={capacity <= CAPACITY_MIN}
                onClick={() =>
                  void updateProfile(userId, { day_capacity: Math.max(CAPACITY_MIN, capacity - CAPACITY_STEP) })
                }
              >
                −
              </StepButton>
              <span className="w-9 text-center font-mono text-15 text-text">{capacity}</span>
              <StepButton
                label="Увеличить ёмкость"
                disabled={capacity >= CAPACITY_MAX}
                onClick={() =>
                  void updateProfile(userId, { day_capacity: Math.min(CAPACITY_MAX, capacity + CAPACITY_STEP) })
                }
              >
                +
              </StepButton>
            </span>
          </Row>

          <Row title="Первый день недели">
            <span className="flex shrink-0 gap-0.5">
              {(
                [
                  ['пн', 1],
                  ['вс', 7],
                ] as const
              ).map(([label, value]) => {
                const on = weekStart === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => void updateProfile(userId, { week_starts_on: value })}
                    className={`flex h-8 items-center rounded-tile px-3.5 text-13 ${
                      on ? 'bg-text font-medium text-bg' : 'bg-surface2 text-text'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </span>
          </Row>
        </Group>

        <Group label="Категории">
          {sortedCats.map((c) => (
            <CategoryItem key={c.id} cat={c} userId={userId} />
          ))}
          {sortedCats.length === 0 && (
            <div className="flex min-h-11 items-center px-3 text-13 text-text-quiet">
              Категорий пока нет
            </div>
          )}
        </Group>

        <Group label="Теги">
          {userTags.map((t) => (
            <div key={t.id} className="flex min-h-11 items-center justify-between gap-3 px-3 py-1.5">
              <span className="min-w-0 truncate font-mono text-13 text-text">#{t.name}</span>
              <button
                type="button"
                onClick={() => void deleteTag(userId, t.id)}
                className="shrink-0 text-13 text-text-muted"
              >
                Удалить
              </button>
            </div>
          ))}
          {userTags.length === 0 && (
            <div className="flex min-h-11 items-center px-3 text-13 text-text-quiet">Тегов пока нет</div>
          )}
        </Group>

        <Group label="Данные">
          <Row title="Экспорт данных" caption="json со всеми задачами и историей">
            <button type="button" onClick={() => void download()} className={`${BTN_COMPACT} text-text`}>
              Выгрузить JSON
            </button>
          </Row>

          <div className="flex flex-col px-3 py-2">
            <div className="flex min-h-7 items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="text-15 text-text">Импорт из Google Takeout</span>
                <span className="mt-0.5 font-mono text-11 text-text-quiet">Tasks.json из выгрузки</span>
              </span>
              <button
                type="button"
                disabled={importing}
                onClick={() => fileRef.current?.click()}
                className={`${BTN_COMPACT} ${importing ? 'text-text-quiet' : 'text-text'}`}
              >
                {importing ? 'Переносим…' : 'Выбрать файл'}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = '' // тот же файл можно выбрать повторно
                if (file) void importTakeout(file)
              }}
            />
            {importResult && (
              <div className="mt-1.5 font-mono text-11 text-text-muted">{importResult}</div>
            )}
          </div>
        </Group>

        <div className="pt-1 text-center font-mono text-11 text-text-quiet">
          Планировщик {APP_VERSION}
        </div>
      </div>
    </div>
  )
}

/** Группа строк: подпись сверху, строки на surface, между ними линия. */
function Group({ label, children }: { label?: string | undefined; children: ReactNode }) {
  return (
    <section className="flex shrink-0 flex-col gap-[5px]">
      {label && <span className="px-1 text-11 text-text-muted">{label}</span>}
      <div className="divide-y divide-line overflow-hidden rounded-tile bg-surface">{children}</div>
    </section>
  )
}

function Row({
  title,
  caption,
  children,
  onPress,
}: {
  title: string
  caption?: string | undefined
  children?: ReactNode
  onPress?: (() => void) | undefined
}) {
  const inner = (
    <>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-15 text-text">{title}</span>
        {caption && (
          <span className="mt-0.5 truncate font-mono text-11 text-text-quiet">{caption}</span>
        )}
      </span>
      {children}
    </>
  )
  const cls = 'flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left'
  return onPress ? (
    <button type="button" onClick={onPress} className={cls}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-tile bg-surface2 text-15 ${
        disabled ? 'text-text-quiet' : 'text-text'
      }`}
    >
      {children}
    </button>
  )
}

/** Строка категории: имя правится инлайн, архив — обратимый (archived_at). */
function CategoryItem({ cat, userId }: { cat: CategoryRow; userId: string }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(cat.name)
  const archived = cat.archived_at !== null

  async function commit(): Promise<void> {
    setEditing(false)
    const next = name.trim()
    if (!next || next === cat.name) {
      setName(cat.name)
      return
    }
    await updateCategory(userId, cat.id, { name: next })
  }

  return (
    <div className="flex min-h-11 items-center gap-3 px-3 py-1.5">
      <CategoryIcon
        icon={cat.icon}
        size={17}
        className={`shrink-0 ${archived ? 'text-text-quiet' : 'text-text-muted'}`}
      />
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit()
            if (e.key === 'Escape') {
              setName(cat.name)
              setEditing(false)
            }
          }}
          onBlur={() => void commit()}
          className="h-8 min-w-0 flex-1 rounded-tile border border-accent bg-surface2 px-2 text-15 text-text outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setName(cat.name)
            setEditing(true)
          }}
          className={`min-w-0 flex-1 truncate text-left text-15 ${archived ? 'text-text-quiet' : 'text-text'}`}
        >
          {cat.name}
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          void updateCategory(userId, cat.id, {
            archived_at: archived ? null : new Date().toISOString(),
          })
        }
        className="shrink-0 text-13 text-text-muted"
      >
        {archived ? 'Вернуть' : 'В архив'}
      </button>
    </div>
  )
}
