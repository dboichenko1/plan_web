// Шторка создания задачи с вложенными шторками напоминаний и повтора.
// Превью собирается из тех же TileData, что и доска: форма честно показывает
// будущий размер, цвет и подпись плитки.

import { useEffect, useState, type ReactNode } from 'react'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import { createTag, createTask, linkTaskTag } from '../data/repo'
import { createTemplate, describeRule } from '../data/templates'
import { TILE } from '../domain/packing'
import { effectiveUrgency } from '../domain/urgency'
import { addDays } from '../domain/date'
import type { Rule } from '../domain/recurrence'
import type { DateStr, Importance, Urgency } from '../domain/types'
import { Sheet } from '../ui/Sheet'
import { Tile, type TileData } from '../ui/Tile'
import { DateField } from '../ui/DateField'
import { CategoryIcon, IconChevronRight, IconClose, IconPlus } from '../ui/icons'
import { dateShort, plural, tileCaption, weekdayShort } from '../ui/format'
import { RepeatSheet } from './RepeatSheet'

const IMPORTANCE_LABEL: Record<Importance, string> = {
  1: 'Мелочь',
  2: 'Обычная',
  3: 'Важная',
  4: 'Ключевая',
}

const URGENCY_LABEL: Record<Urgency, string> = {
  1: 'Когда-нибудь',
  2: 'На неделе',
  3: 'Скоро',
  4: 'Горит',
}

const IMPORTANCE_ORDER: readonly Importance[] = [1, 2, 3, 4]
// Порядок ряда: от «горит» к «когда-нибудь».
const URGENCY_ORDER: readonly Urgency[] = [4, 3, 2, 1]

const REMIND_OPTIONS = [
  { minutes: 0, label: 'В момент срока', chip: 'в момент' },
  { minutes: 15, label: 'За 15 минут', chip: 'за 15 мин' },
  { minutes: 60, label: 'За час', chip: 'за час' },
  { minutes: 1440, label: 'За день', chip: 'за день' },
] as const

function remindChip(minutes: number): string {
  return REMIND_OPTIONS.find((o) => o.minutes === minutes)?.chip ?? `${minutes} мин`
}

// Превью — полноразмерная плитка (ячейка 89), уменьшенная трансформацией:
// типографика сжимается пропорционально и ведёт себя ровно как на борде.
const CELL = 42
const GAP = 4
const FULL_CELL = 89
const PREVIEW_SCALE = CELL / FULL_CELL

const CHIP_INPUT =
  'h-[30px] rounded-tile border-0 bg-surface2 px-2.5 font-mono text-13 text-text outline-none'

export function CreateTaskSheet({
  open,
  onClose,
  userId,
  today,
  defaultDay,
}: {
  open: boolean
  onClose: () => void
  userId: string
  today: DateStr
  defaultDay: DateStr
}) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [importance, setImportance] = useState<Importance>(2)
  const [urgencyManual, setUrgencyManual] = useState<Urgency>(2)
  const [dueOn, setDueOn] = useState('') // '' — срок не задан
  const [dueTime, setDueTime] = useState('')
  const [scheduledOn, setScheduledOn] = useState<DateStr | null>(defaultDay)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [remind, setRemind] = useState<number[]>([])
  const [tagIds, setTagIds] = useState<string[]>([])
  const [repeat, setRepeat] = useState<Rule | null>(null)
  const [remindOpen, setRemindOpen] = useState(false)
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [addingTag, setAddingTag] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)

  // Форма собирается заново при каждом открытии: defaultDay читаем в этот момент,
  // смена дня при открытой шторке черновик не трогает.
  useEffect(() => {
    if (!open) return
    setTitle('')
    setNote('')
    setImportance(2)
    setUrgencyManual(2)
    setDueOn('')
    setDueTime('')
    setScheduledOn(defaultDay)
    setCategoryId(null)
    setRemind([])
    setTagIds([])
    setRepeat(null)
    setRemindOpen(false)
    setRepeatOpen(false)
    setAddingTag(false)
    setNewTag('')
    setSaving(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const categories = useLive(() => db.categories.orderBy('sort_order').toArray(), [userId])
  const tags = useLive(() => db.tags.orderBy('name').toArray(), [userId])

  const visibleCategories = (categories ?? []).filter(
    (c) => c.user_id === userId && !c.archived_at,
  )
  const userTags = (tags ?? []).filter((t) => t.user_id === userId)

  const dueSet = dueOn !== ''
  const effUrgency: Urgency = dueSet
    ? effectiveUrgency({ due_on: dueOn, urgency_manual: urgencyManual }, today)
    : urgencyManual
  const selectedCategory = visibleCategories.find((c) => c.id === categoryId)

  const size = TILE[importance]
  const cells = size.w * size.h
  const preview: TileData = {
    id: 'new-task-preview',
    title: title.trim() || 'Новая задача',
    importance,
    urgency: effUrgency,
    state: 'live',
    categoryIcon: selectedCategory?.icon ?? null,
    caption:
      tileCaption(dueOn || null, dueTime || null, selectedCategory?.name ?? null, today) || null,
    hangingDays: 0,
    repeating: repeat !== null,
  }

  const scheduledCaption =
    scheduledOn === null
      ? 'без дня'
      : scheduledOn === today
        ? 'в план на сегодня'
        : scheduledOn === addDays(today, 1)
          ? 'в план на завтра'
          : null

  const remindSorted = [...remind].sort((a, b) => a - b)
  const shownChips = remindSorted.slice(0, 2)
  const extraChips = remindSorted.length - shownChips.length

  const canSubmit = title.trim().length > 0 && !saving

  async function submit() {
    const name = title.trim()
    if (!name || saving) return
    setSaving(true)
    try {
      if (repeat) {
        // Повторяющаяся задача — это шаблон: экземпляры создаёт материализация,
        // отдельную одиночную задачу не заводим. Теги к шаблону не применяются.
        await createTemplate(
          {
            title: name,
            note: note.trim() ? note.trim() : null,
            importance,
            urgency_manual: urgencyManual,
            due_time: dueTime || null,
            remind_before: dueTime ? remindSorted : [],
            category_id: categoryId,
            // Серия стартует с выбранного дня плана, а не с дня открытия шторки.
            rule: { ...repeat, starts_on: scheduledOn ?? today },
          },
          userId,
          today,
        )
        onClose()
        return
      }
      const task = await createTask(
        {
          user_id: userId,
          title: name,
          note: note.trim() ? note.trim() : null,
          importance,
          urgency_manual: urgencyManual,
          due_on: dueOn || null,
          due_time: dueTime || null,
          remind_before: dueTime ? remindSorted : [],
          scheduled_on: scheduledOn,
          category_id: categoryId,
        },
        today,
      )
      for (const tagId of tagIds) {
        await linkTaskTag(task.id, tagId, userId)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function commitTag() {
    const name = newTag.trim().replace(/^#+/, '').trim()
    setNewTag('')
    setAddingTag(false)
    if (!name) return
    const existing = userTags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      setTagIds((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]))
      return
    }
    const id = await createTag(userId, name)
    setTagIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} height="70%">
        <div className="flex min-h-0 flex-1 flex-col bg-surface">
          <div className="flex shrink-0 justify-center pb-1.5 pt-2">
            <div className="h-1 w-9 rounded-tile bg-line" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название задачи"
              className="h-11 shrink-0 rounded-tile border border-line bg-surface2 px-3 text-15 text-text outline-none placeholder:text-text-quiet focus:border-accent"
            />

            {/* Живое превью: реальные пропорции TILE в уменьшенной ячейке. */}
            <div className="flex shrink-0 items-center gap-3.5" style={{ minHeight: CELL * 2 + GAP }}>
              <div
                className="shrink-0 overflow-hidden"
                style={{
                  width: (size.w * FULL_CELL + (size.w - 1) * GAP) * PREVIEW_SCALE,
                  height: (size.h * FULL_CELL + (size.h - 1) * GAP) * PREVIEW_SCALE,
                }}
              >
                <Tile
                  tile={preview}
                  style={{
                    width: size.w * FULL_CELL + (size.w - 1) * GAP,
                    height: size.h * FULL_CELL + (size.h - 1) * GAP,
                    transform: `scale(${PREVIEW_SCALE})`,
                    transformOrigin: 'top left',
                  }}
                />
              </div>
              <div className="font-mono text-11 text-text-quiet" style={{ lineHeight: 1.7 }}>
                <div>
                  {IMPORTANCE_LABEL[importance].toLowerCase()} · {URGENCY_LABEL[effUrgency].toLowerCase()}
                </div>
                <div>
                  плитка {size.w}×{size.h}, urgency-{effUrgency}
                </div>
                <div>
                  займёт {cells} {plural(cells, 'ячейку', 'ячейки', 'ячеек')}
                </div>
              </div>
            </div>

            <Section label="Важность">
              <div className="grid grid-cols-4 gap-1">
                {IMPORTANCE_ORDER.map((v) => {
                  const on = v === importance
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setImportance(v)}
                      className="h-[34px] whitespace-nowrap rounded-tile text-13"
                      style={
                        on
                          ? { background: 'var(--text)', color: 'var(--bg)', fontWeight: 500 }
                          : { background: 'var(--surface2)', color: 'var(--text)' }
                      }
                    >
                      {IMPORTANCE_LABEL[v]}
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section label="Срочность" caption={dueSet ? 'считается от срока' : undefined}>
              <div className="grid grid-cols-4 gap-1">
                {URGENCY_ORDER.map((v) => {
                  const on = v === effUrgency
                  return (
                    <button
                      key={v}
                      type="button"
                      disabled={dueSet}
                      onClick={() => setUrgencyManual(v)}
                      className="h-[34px] whitespace-nowrap rounded-tile text-13"
                      style={
                        on
                          ? { background: `var(--u${v})`, color: `var(--on-u${v})`, fontWeight: 500 }
                          : {
                              background: 'var(--surface2)',
                              color: 'var(--text)',
                              opacity: dueSet ? 0.55 : undefined,
                            }
                      }
                    >
                      {URGENCY_LABEL[v]}
                    </button>
                  )
                })}
              </div>
            </Section>

            <div className="flex shrink-0 flex-col">
              <div className="flex h-[42px] items-center justify-between border-b border-line">
                <span className="text-15 text-text">Дата и время</span>
                <span className="flex items-center gap-1">
                  <DateField
                    value={dueOn}
                    onChange={setDueOn}
                    placeholder="дата"
                    className={CHIP_INPUT + ' text-13'}
                  />
                  <input
                    type="time"
                    aria-label="Время срока"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className={CHIP_INPUT}
                  />
                  {dueSet && (
                    <button
                      type="button"
                      aria-label="Убрать срок"
                      onClick={() => setDueOn('')}
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-tile bg-surface2 text-text-quiet"
                    >
                      <IconClose size={11} />
                    </button>
                  )}
                </span>
              </div>

              <div className="flex h-[42px] items-center justify-between border-b border-line">
                <span className="text-15 text-text">В план на день</span>
                <span className="flex items-center gap-1">
                  {scheduledCaption && (
                    <span className="mr-1 text-13 text-text-quiet">{scheduledCaption}</span>
                  )}
                  <DateField
                    value={scheduledOn ?? ''}
                    onChange={(v) => setScheduledOn(v || null)}
                    placeholder="день"
                    className={CHIP_INPUT + ' text-13'}
                  />
                  {scheduledOn !== null && (
                    <button
                      type="button"
                      aria-label="Убрать из плана"
                      onClick={() => setScheduledOn(null)}
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-tile bg-surface2 text-text-quiet"
                    >
                      <IconClose size={11} />
                    </button>
                  )}
                </span>
              </div>

              <button
                type="button"
                disabled={!dueTime}
                onClick={() => setRemindOpen(true)}
                className="flex h-[42px] w-full items-center justify-between border-b border-line text-left"
              >
                <span className="text-15 text-text">Напомнить</span>
                {dueTime ? (
                  <span className="flex items-center gap-1">
                    {remindSorted.length === 0 && (
                      <span className="text-13 text-text-muted">Без напоминания</span>
                    )}
                    {shownChips.map((m) => (
                      <span
                        key={m}
                        className="flex h-[30px] items-center rounded-tile bg-surface2 px-2.5 text-13 text-text"
                      >
                        {remindChip(m)}
                      </span>
                    ))}
                    {extraChips > 0 && (
                      <span className="flex h-[30px] items-center rounded-tile bg-surface2 px-2.5 font-mono text-13 text-text">
                        +{extraChips}
                      </span>
                    )}
                    <IconChevronRight size={12} className="text-text-quiet" />
                  </span>
                ) : (
                  <span className="text-13 text-text-quiet">нужно время</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setRepeatOpen(true)}
                className="flex h-[42px] w-full items-center justify-between border-b border-line text-left"
              >
                <span className="text-15 text-text">Повтор</span>
                <span className="flex min-w-0 items-center gap-1">
                  <span
                    className={
                      repeat
                        ? 'max-w-[230px] truncate text-13 text-text'
                        : 'text-13 text-text-muted'
                    }
                  >
                    {repeat ? describeRule(repeat) : 'Не повторять'}
                  </span>
                  <IconChevronRight size={12} className="shrink-0 text-text-quiet" />
                </span>
              </button>
            </div>

            <Section label="Категория">
              <div className="grid grid-cols-7 gap-1">
                {visibleCategories.map((c) => {
                  const on = c.id === categoryId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-label={c.name}
                      onClick={() => setCategoryId(on ? null : c.id)}
                      className="flex h-10 items-center justify-center rounded-tile"
                      style={
                        on
                          ? { background: 'var(--text)', color: 'var(--bg)' }
                          : { background: 'var(--surface2)', color: 'var(--text-muted)' }
                      }
                    >
                      <CategoryIcon icon={c.icon} size={17} />
                    </button>
                  )
                })}
              </div>
            </Section>

            <div className="flex shrink-0 flex-wrap gap-1">
              {userTags.map((t) => {
                const on = tagIds.includes(t.id)
                return on ? (
                  <button
                    key={t.id}
                    type="button"
                    aria-label={`Снять тег ${t.name}`}
                    onClick={() => setTagIds((prev) => prev.filter((id) => id !== t.id))}
                    className="flex h-8 items-center gap-2 rounded-tile bg-surface2 px-3"
                  >
                    <span className="font-mono text-13 text-text">#{t.name}</span>
                    <IconClose size={11} className="text-text-quiet" />
                  </button>
                ) : (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTagIds((prev) => [...prev, t.id])}
                    className="flex h-8 items-center rounded-tile border border-line px-3"
                  >
                    <span className="font-mono text-13 text-text-muted">#{t.name}</span>
                  </button>
                )
              })}
              {addingTag ? (
                <span className="flex h-8 items-center rounded-tile bg-surface2 px-3">
                  <input
                    autoFocus
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitTag()
                      if (e.key === 'Escape') {
                        setNewTag('')
                        setAddingTag(false)
                      }
                    }}
                    onBlur={() => void commitTag()}
                    placeholder="имя тега"
                    className="w-[120px] border-0 bg-transparent font-mono text-13 text-text outline-none placeholder:text-text-quiet"
                  />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingTag(true)}
                  className="flex h-8 items-center gap-2 rounded-tile border border-dashed border-line px-3"
                >
                  <IconPlus size={11} className="text-text-quiet" />
                  <span className="text-13 text-text-quiet">добавить тег</span>
                </button>
              )}
            </div>

            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Заметка"
              className="shrink-0 resize-none rounded-tile border border-transparent bg-surface2 px-3 py-2 text-13 text-text outline-none placeholder:text-text-quiet focus:border-accent"
            />
          </div>

          <div className="shrink-0 px-4 pb-2.5 pt-2">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit()}
              className="h-11 w-full rounded-tile text-15 font-medium"
              style={
                canSubmit
                  ? { background: 'var(--text)', color: 'var(--bg)' }
                  : { background: 'var(--surface2)', color: 'var(--text-quiet)' }
              }
            >
              Добавить задачу
            </button>
          </div>
        </div>
      </Sheet>

      <ReminderSheet
        open={remindOpen}
        onClose={() => setRemindOpen(false)}
        dueOn={dueOn}
        dueTime={dueTime}
        value={remind}
        onSave={setRemind}
      />

      <RepeatSheet
        open={repeatOpen}
        onClose={() => setRepeatOpen(false)}
        value={repeat}
        onChange={setRepeat}
        startsOn={scheduledOn ?? today}
      />
    </>
  )
}

function Section({
  label,
  caption,
  children,
}: {
  label: string
  caption?: string | undefined
  children: ReactNode
}) {
  return (
    <div className="flex shrink-0 flex-col gap-[5px]">
      <div className="flex items-baseline justify-between">
        <span className="text-11 text-text-muted">{label}</span>
        {caption && <span className="font-mono text-11 text-text-quiet">{caption}</span>}
      </div>
      {children}
    </div>
  )
}

/** Вложенная шторка напоминаний: множественный выбор смещений в минутах. */
function ReminderSheet({
  open,
  onClose,
  dueOn,
  dueTime,
  value,
  onSave,
}: {
  open: boolean
  onClose: () => void
  dueOn: string
  dueTime: string
  value: number[]
  onSave: (next: number[]) => void
}) {
  const [draft, setDraft] = useState<number[]>(value)

  // Черновик набирается заново при открытии: закрытие без «Сохранить» выбор не меняет.
  useEffect(() => {
    if (open) setDraft(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const parts: string[] = []
  if (dueOn) parts.push(`${weekdayShort(dueOn)}, ${dateShort(dueOn)}`)
  if (dueTime) parts.push(dueTime)

  function toggle(minutes: number) {
    setDraft((d) => (d.includes(minutes) ? d.filter((m) => m !== minutes) : [...d, minutes]))
  }

  return (
    <Sheet open={open} onClose={onClose} height="52%">
      <div className="flex min-h-0 flex-1 flex-col bg-surface">
        <div className="flex shrink-0 justify-center pb-1.5 pt-2">
          <div className="h-1 w-9 rounded-tile bg-line" />
        </div>
        <div className="shrink-0 px-4">
          <div className="font-tile text-24 font-semibold text-text">Напомнить</div>
          {parts.length > 0 && (
            <div className="mt-1 font-mono text-11 text-text-quiet">срок: {parts.join(', ')}</div>
          )}
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-4">
          {REMIND_OPTIONS.map((o) => {
            const on = draft.includes(o.minutes)
            return (
              <button
                key={o.minutes}
                type="button"
                onClick={() => toggle(o.minutes)}
                className="flex h-[46px] w-full items-center justify-between border-b border-line text-left"
              >
                <span className="text-15 text-text">{o.label}</span>
                <span
                  className="h-3.5 w-3.5 rounded-tile"
                  style={on ? { background: 'var(--accent)' } : { border: '1px solid var(--line)' }}
                />
              </button>
            )
          })}
          <div className="flex h-[46px] items-center justify-between">
            <span className="text-15 text-text-muted">Своё время</span>
            <span className="font-mono text-11 text-text-quiet">появится позже</span>
          </div>
        </div>
        <div className="shrink-0 px-4 pb-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              onSave([...draft].sort((a, b) => a - b))
              onClose()
            }}
            className="h-11 w-full rounded-tile text-15 font-medium"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
          >
            Сохранить напоминания
          </button>
        </div>
      </div>
    </Sheet>
  )
}
