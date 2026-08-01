import { useMemo, useState } from 'react'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import type { CategoryRow, TaskRow } from '../data/contract'
import { addDays } from '../domain/date'
import { occupiedCells, TILE } from '../domain/packing'
import { taskState } from '../domain/state'
import { effectiveUrgency } from '../domain/urgency'
import type { DateStr } from '../domain/types'
import { Board, GAP, useCellSize, type BoardItem } from '../ui/Board'
import { CapacityBar } from '../ui/CapacityBar'
import { Tile } from '../ui/Tile'
import { toTileData } from '../ui/taskTile'
import { dateLong, weekdayName } from '../ui/format'
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconInbox } from '../ui/icons'

export function DayScreen({
  userId,
  today,
  day,
  onDayChange,
  onOpenTask,
  onOpenInbox,
  hangingOpen,
  onToggleHanging,
  hangingPanel,
}: {
  userId: string
  today: DateStr
  day: DateStr
  onDayChange: (d: DateStr) => void
  onOpenTask: (id: string) => void
  onOpenInbox: () => void
  hangingOpen: boolean
  onToggleHanging: () => void
  hangingPanel?: React.ReactNode
}) {
  const tasks = useLive(
    () =>
      db.tasks
        .where('scheduled_on')
        .equals(day)
        .and((t) => t.user_id === userId && !t.deleted_at)
        .toArray(),
    [day, userId],
  )
  const hangingTasks = useLive(
    () =>
      db.tasks
        .where('scheduled_on')
        .below(today)
        .and((t) => t.user_id === userId && !t.deleted_at && t.status === 'open')
        .toArray(),
    [today, userId],
  )
  const categories = useLive(() => db.categories.toArray(), [userId])
  const profile = useLive(() => db.profiles.get(userId), [userId])

  const catMap = useMemo(
    () => new Map<string, CategoryRow>((categories ?? []).map((c) => [c.id, c])),
    [categories],
  )

  const open = (tasks ?? [])
    .filter((t) => t.status === 'open')
    .sort((a, b) => a.order_index - b.order_index)
  const done = (tasks ?? [])
    .filter((t) => t.status === 'done')
    .sort((a, b) => (a.completed_at ?? '') < (b.completed_at ?? '') ? 1 : -1)

  const { ref, cell, width } = useCellSize(4)

  const items: BoardItem[] = open.map((t) => ({
    id: t.id,
    importance: t.importance,
    content: (
      <button type="button" className="block h-full w-full text-left" onClick={() => onOpenTask(t.id)}>
        <Tile tile={toTileData(t, today, catMap)} style={{ height: '100%' }} />
      </button>
    ),
  }))

  const occupied = occupiedCells(
    open.map((t) => ({ importance: t.importance, state: taskState(t, today) })),
  )
  const capacity = profile?.day_capacity ?? 32
  const hanging = (hangingTasks ?? []).sort((a, b) =>
    effectiveUrgency(b, today) - effectiveUrgency(a, today),
  )

  return (
    <div className="flex h-full flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="shrink-0 px-3 pt-1.5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-tile text-24 font-semibold leading-[1.1] text-text">
              {weekdayName(day)}
            </h1>
            <div className="mt-0.5 font-mono text-11 text-text-quiet">
              {dateLong(day)}
              {day !== today && ` · ${day < today ? 'прошло' : 'впереди'}`}
            </div>
          </div>
          <div className="flex gap-1">
            <HeaderButton label="Инбокс" onClick={onOpenInbox}>
              <IconInbox size={15} />
            </HeaderButton>
            <HeaderButton label="Предыдущий день" onClick={() => onDayChange(addDays(day, -1))}>
              <IconChevronLeft size={15} />
            </HeaderButton>
            <HeaderButton label="Следующий день" onClick={() => onDayChange(addDays(day, 1))}>
              <IconChevronRight size={15} />
            </HeaderButton>
          </div>
        </div>

        {day === today && hanging.length > 0 && (
          <button
            type="button"
            onClick={onToggleHanging}
            className="mt-2.5 flex h-[34px] w-full items-center justify-between rounded-tile bg-surface px-3"
          >
            <span className="flex items-center gap-2.5">
              <span className="text-13 text-text">Висят</span>
              <span className="font-mono text-13 text-text-muted">{hanging.length}</span>
              <span className="flex gap-[3px]">
                {hanging.slice(0, 8).map((t) => (
                  <span
                    key={t.id}
                    className="h-[5px] w-[5px]"
                    style={{ background: `var(--u${effectiveUrgency(t, today)})` }}
                  />
                ))}
              </span>
            </span>
            <span
              className="text-text-quiet"
              style={{ transform: hangingOpen ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}
            >
              <IconChevronDown size={14} />
            </span>
          </button>
        )}

        {day === today && hangingOpen && hangingPanel}

        <div className="mt-2.5">
          <CapacityBar occupied={occupied} capacity={capacity} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div ref={ref} className="pt-2.5">
          <div style={{ width, margin: '0 auto' }}>
            {open.length === 0 && done.length === 0 ? (
              <EmptyDay onOpenInbox={onOpenInbox} />
            ) : (
              <Board items={items} cell={cell} />
            )}
          </div>
        </div>

        {done.length > 0 && (
          <div className="pt-2.5" style={{ width, margin: '0 auto' }}>
            <div className="mb-[5px] font-mono text-11 text-text-quiet">сделано · {done.length}</div>
            <div className="flex flex-wrap gap-1">
              {done.map((t) => (
                <DoneTile key={t.id} task={t} cell={cell} today={today} catMap={catMap} onOpen={onOpenTask} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function HeaderButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-tile bg-surface text-text-muted"
    >
      {children}
    </button>
  )
}

function DoneTile({
  task,
  cell,
  today,
  catMap,
  onOpen,
}: {
  task: TaskRow
  cell: number
  today: DateStr
  catMap: ReadonlyMap<string, CategoryRow>
  onOpen: (id: string) => void
}) {
  // Размер не меняется от состояния — выполненная ключевая остаётся 4×2.
  const { w, h } = TILE[task.importance]
  return (
    <button
      type="button"
      className="block text-left"
      style={{ width: w * cell + (w - 1) * GAP, height: h * cell + (h - 1) * GAP }}
      onClick={() => onOpen(task.id)}
    >
      <Tile tile={toTileData(task, today, catMap)} style={{ height: '100%' }} />
    </button>
  )
}

function EmptyDay({ onOpenInbox }: { onOpenInbox: () => void }) {
  return (
    <div className="pt-24 text-center">
      <p className="text-15 text-text-muted">На сегодня пусто.</p>
      <p className="mt-1 text-13 text-text-quiet">
        Перетащите задачу из{' '}
        <button type="button" className="underline" onClick={onOpenInbox}>
          инбокса
        </button>{' '}
        или добавьте новую.
      </p>
    </div>
  )
}

export function useSelectedDay(today: DateStr): [DateStr, (d: DateStr) => void] {
  const [day, setDay] = useState<DateStr | null>(null)
  return [day ?? today, setDay]
}
