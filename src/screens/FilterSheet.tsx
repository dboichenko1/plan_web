// Шторка фильтров. Контролируемая: каждый тумблер сразу зовёт
// onChange, вызывающий пересчитывает candidateCount через applyFilter —
// шторка только показывает живое число в кнопке «Показать N задач».

import { type ReactNode } from 'react'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import { EMPTY_FILTER, type FilterSort, type FilterTaskState, type TaskFilter } from '../data/filters'
import type { DateStr, Importance, Urgency } from '../domain/types'
import { Sheet } from '../ui/Sheet'
import { CategoryIcon } from '../ui/icons'
import { plural } from '../ui/format'

const STATE_ORDER: readonly FilterTaskState[] = ['live', 'slipped', 'done']
const STATE_LABEL: Record<FilterTaskState, string> = {
  live: 'живые',
  slipped: 'слетевшие',
  done: 'выполненные',
}

// Порядок ряда: от «горит» к «когда-нибудь».
const URGENCY_ORDER: readonly Urgency[] = [4, 3, 2, 1]
const URGENCY_LABEL: Record<Urgency, string> = {
  1: 'когда-нибудь',
  2: 'на неделе',
  3: 'скоро',
  4: 'горит',
}

const IMPORTANCE_ORDER: readonly Importance[] = [1, 2, 3, 4]
const IMPORTANCE_LABEL: Record<Importance, string> = {
  1: 'мелочь',
  2: 'обычная',
  3: 'важная',
  4: 'ключевая',
}

const SORT_ORDER: readonly FilterSort[] = ['natural', 'due', 'created']
const SORT_LABEL: Record<FilterSort, string> = {
  natural: 'естественная',
  due: 'по сроку',
  created: 'по созданию',
}

// Инверсия «текст на фоне» — так выглядят активные кнопки во всём приложении.
const ON = { background: 'var(--text)', color: 'var(--bg)', fontWeight: 500 } as const
const OFF = { background: 'var(--surface2)', color: 'var(--text-quiet)' } as const

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

export function FilterSheet({
  open,
  onClose,
  value,
  onChange,
  userId,
  candidateCount,
}: {
  open: boolean
  onClose: () => void
  value: TaskFilter
  onChange: (next: TaskFilter) => void
  userId: string
  /** today нужен вызывающему для applyFilter; сама шторка ничего не считает. */
  today: DateStr
  candidateCount: number
}) {
  const categories = useLive(() => db.categories.orderBy('sort_order').toArray(), [userId])
  const tags = useLive(() => db.tags.orderBy('name').toArray(), [userId])

  // Счётчик использования тега: сколько неудалённых задач пользователя его носят.
  const tagCounts = useLive(async () => {
    const [links, tasks] = await Promise.all([db.task_tags.toArray(), db.tasks.toArray()])
    const alive = new Set(
      tasks.filter((t) => t.user_id === userId && t.deleted_at === null).map((t) => t.id),
    )
    const counts = new Map<string, number>()
    for (const l of links) {
      if (alive.has(l.task_id)) counts.set(l.tag_id, (counts.get(l.tag_id) ?? 0) + 1)
    }
    return counts
  }, [userId])

  const visibleCategories = (categories ?? []).filter(
    (c) => c.user_id === userId && !c.archived_at,
  )
  // Теги — по убыванию использования; при равенстве — по алфавиту.
  const userTags = (tags ?? [])
    .filter((t) => t.user_id === userId)
    .sort((a, b) => {
      const diff = (tagCounts?.get(b.id) ?? 0) - (tagCounts?.get(a.id) ?? 0)
      return diff !== 0 ? diff : a.name.localeCompare(b.name, 'ru')
    })

  return (
    <Sheet open={open} onClose={onClose} height="84%">
      <div className="flex min-h-0 flex-1 flex-col bg-surface">
        <div className="flex shrink-0 justify-center pb-1.5 pt-2">
          <div className="h-1 w-9 rounded-tile bg-line" />
        </div>
        <div className="shrink-0 px-4">
          <div className="font-tile text-24 font-semibold text-text">Фильтры</div>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4">
          <Section label="Состояние">
            <div className="grid grid-cols-3 gap-1">
              {STATE_ORDER.map((s) => {
                const on = value.states.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChange({ ...value, states: toggle(value.states, s) })}
                    className="h-[34px] whitespace-nowrap rounded-tile text-13"
                    style={on ? ON : OFF}
                  >
                    {STATE_LABEL[s]}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section label="Категории">
            <div className="grid grid-cols-7 gap-1">
              {visibleCategories.map((c) => {
                const on = value.categories.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={c.name}
                    aria-pressed={on}
                    onClick={() =>
                      onChange({ ...value, categories: toggle(value.categories, c.id) })
                    }
                    className="flex h-[42px] items-center justify-center rounded-tile"
                    style={on ? ON : OFF}
                  >
                    <CategoryIcon icon={c.icon} size={17} />
                  </button>
                )
              })}
            </div>
          </Section>

          {userTags.length > 0 && (
            <Section label="Теги">
              <div className="flex flex-wrap gap-1">
                {userTags.map((t) => {
                  const on = value.tags.includes(t.id)
                  const count = tagCounts?.get(t.id) ?? 0
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onChange({ ...value, tags: toggle(value.tags, t.id) })}
                      className="flex h-[34px] items-center gap-2 rounded-tile px-3"
                      style={{ background: on ? 'var(--text)' : 'var(--surface2)' }}
                    >
                      <span
                        className="font-mono text-13"
                        style={{ color: on ? 'var(--bg)' : 'var(--text)' }}
                      >
                        #{t.name}
                      </span>
                      <span
                        className="font-mono text-11"
                        style={
                          on
                            ? { color: 'var(--bg)', opacity: 0.6 }
                            : { color: 'var(--text-quiet)' }
                        }
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Section>
          )}

          <Section label="Срочность">
            <div className="grid grid-cols-4 gap-1">
              {URGENCY_ORDER.map((v) => {
                const on = value.urgency.includes(v)
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onChange({ ...value, urgency: toggle(value.urgency, v) })}
                    className={`flex h-[34px] items-center justify-center gap-1.5 whitespace-nowrap rounded-tile ${v === 1 ? 'text-11' : 'text-13'}`}
                    style={
                      on
                        ? { background: `var(--u${v})`, color: `var(--on-u${v})`, fontWeight: 500 }
                        : OFF
                    }
                  >
                    {/* Квадратик цвета срочности; на залитой кнопке сливается с фоном. */}
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-tile"
                      style={{ background: `var(--u${v})` }}
                    />
                    {URGENCY_LABEL[v]}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section label="Важность">
            <div className="grid grid-cols-4 gap-1">
              {IMPORTANCE_ORDER.map((v) => {
                const on = value.importance.includes(v)
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() =>
                      onChange({ ...value, importance: toggle(value.importance, v) })
                    }
                    className="h-[34px] whitespace-nowrap rounded-tile text-13"
                    style={on ? ON : OFF}
                  >
                    {IMPORTANCE_LABEL[v]}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section label="Сортировка">
            <div className="grid grid-cols-3 gap-1">
              {SORT_ORDER.map((s) => {
                const on = value.sort === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChange({ ...value, sort: s })}
                    className="h-[34px] whitespace-nowrap rounded-tile text-13"
                    style={on ? ON : OFF}
                  >
                    {SORT_LABEL[s]}
                  </button>
                )
              })}
            </div>
          </Section>
        </div>

        <div className="flex shrink-0 gap-1 px-4 pb-2.5 pt-2">
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTER)}
            className="h-12 w-[110px] rounded-tile bg-surface2 text-15 font-medium text-text-muted"
          >
            Сбросить
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-tile text-15 font-medium"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
          >
            Показать {candidateCount} {plural(candidateCount, 'задачу', 'задачи', 'задач')}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <span className="text-11 text-text-muted">{label}</span>
      {children}
    </div>
  )
}
