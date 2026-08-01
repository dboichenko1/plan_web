// Инбокс (макет 06): нераспределённые задачи в один столбец полной ширины.
// Размер не работает, цвет срочности и значок категории есть.

import { useMemo, useState } from 'react'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import type { CategoryRow, TaskRow } from '../data/contract'
import { moveTaskToDay, softDeleteTask } from '../data/repo'
import { naturalCompare } from '../domain/ordering'
import { effectiveUrgency } from '../domain/urgency'
import type { DateStr } from '../domain/types'
import { useDraggable } from '@dnd-kit/core'
import { CategoryIcon, IconSearch } from '../ui/icons'
import { SwipeRow } from '../ui/SwipeRow'
import { plural, tileCaption } from '../ui/format'

export function InboxScreen({
  userId,
  today,
  onOpenTask,
  compact = false,
  draggingId = null,
}: {
  userId: string
  today: DateStr
  onOpenTask: (id: string) => void
  /** Треть экрана при перетаскивании (макет 05): без поиска и подсказок. */
  compact?: boolean
  draggingId?: string | null
}) {
  const [query, setQuery] = useState('')
  const tasks = useLive(
    () =>
      db.tasks
        .filter(
          (t) =>
            t.user_id === userId && t.scheduled_on === null && !t.deleted_at && t.status === 'open',
        )
        .toArray(),
    [userId],
  )
  const categories = useLive(() => db.categories.toArray(), [userId])
  const catMap = useMemo(
    () => new Map<string, CategoryRow>((categories ?? []).map((c) => [c.id, c])),
    [categories],
  )

  const list = (tasks ?? [])
    .filter((t) => !query || t.title.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) =>
      naturalCompare(
        { urgency: effectiveUrgency(a, today), importance: a.importance },
        { urgency: effectiveUrgency(b, today), importance: b.importance },
      ),
    )
  const total = tasks?.length ?? 0

  return (
    <div className="flex h-full flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="shrink-0 px-3 pt-1.5">
        <div className="flex items-baseline justify-between">
          <h1 className="font-tile text-24 font-semibold text-text">Инбокс</h1>
          <span className="font-mono text-11 text-text-quiet">
            {total} {plural(total, 'задача', 'задачи', 'задач')} без даты
          </span>
        </div>
        {!compact && (
        <label className="mt-2.5 flex h-10 items-center gap-2.5 rounded-tile border border-line bg-surface px-3">
          <span className="text-text-quiet">
            <IconSearch size={15} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти задачу"
            className="w-full bg-transparent text-13 text-text outline-none placeholder:text-text-quiet"
          />
        </label>
        )}
      </div>

      <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="flex flex-col gap-1">
          {list.map((t) => (
            <InboxRow
              key={t.id}
              task={t}
              today={today}
              catMap={catMap}
              onOpen={() => onOpenTask(t.id)}
              draggingId={draggingId}
            />
          ))}
        </div>
        {list.length === 0 && (
          <div className="pt-24 text-center">
            <p className="text-15 text-text-muted">
              {query ? 'Ничего не нашлось.' : 'Инбокс пуст.'}
            </p>
            <p className="mt-1 text-13 text-text-quiet">
              {query ? 'Попробуйте другое слово.' : 'Всё разложено по дням.'}
            </p>
          </div>
        )}
        {list.length > 0 && !compact && (
          <p className="mt-2.5 font-mono text-[10px] text-text-quiet">
            свайп вправо — на сегодня · влево — удалить · долгое нажатие — перетащить
          </p>
        )}
      </div>
    </div>
  )
}

export function InboxRow({
  task,
  today,
  catMap,
  onOpen,
  draggingId = null,
}: {
  task: TaskRow
  today: DateStr
  catMap: ReadonlyMap<string, CategoryRow>
  onOpen: () => void
  draggingId?: string | null
}) {
  const u = effectiveUrgency(task, today)
  const category = task.category_id ? catMap.get(task.category_id) : undefined
  const caption =
    tileCaption(task.due_on, task.due_time, category?.name ?? null, today) ||
    `без срока${category ? ` · ${category.name.toLowerCase()}` : ''}`

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `drag:inbox:${task.id}`,
    data: { type: 'inbox-row', task },
  })

  return (
    <SwipeRow
      rightLabel={<span className="text-13 font-medium" style={{ color: 'var(--on-u2)' }}>На сегодня</span>}
      leftLabel={<span className="text-13 font-medium" style={{ color: 'var(--on-u4)' }}>Удалить</span>}
      onSwipeRight={() => void moveTaskToDay(task.id, today, today)}
      onSwipeLeft={() => void softDeleteTask(task.id)}
      onTap={onOpen}
      disabled={draggingId !== null}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className="flex h-14 items-center justify-between rounded-tile px-3"
        style={{
          background: `var(--u${u})`,
          color: `var(--on-u${u})`,
          touchAction: 'none',
          opacity: isDragging ? 0.35 : 1,
        }}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {category && (
            <span style={{ opacity: 0.85 }}>
              <CategoryIcon icon={category.icon} size={15} />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-tile text-15 font-medium">{task.title}</span>
            <span className="block text-11" style={{ opacity: 0.7 }}>
              {caption}
            </span>
          </span>
        </span>
        <span className="ml-2 flex shrink-0 gap-[2px]">
          {Array.from({ length: u }, (_, i) => (
            <span key={i} className="h-1 w-1" style={{ background: 'currentColor' }} />
          ))}
        </span>
      </div>
    </SwipeRow>
  )
}
