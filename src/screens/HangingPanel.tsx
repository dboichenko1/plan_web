// Развёрнутая полоса «Висят» — ключевой экран идеи: серые плитки
// обязаны различаться между собой. Полоса — фильтр по всем прошедшим дням,
// не копия: задачи остаются на своих старых днях.

import { useRef, useState } from 'react'
import type { CategoryRow, TaskRow } from '../data/contract'
import { moveTaskToDay, softDeleteTask } from '../data/repo'
import { naturalCompare } from '../domain/ordering'
import { effectiveUrgency } from '../domain/urgency'
import type { DateStr } from '../domain/types'
import { Board, type BoardItem } from '../ui/Board'
import { Tile } from '../ui/Tile'
import { toTileData } from '../ui/taskTile'

export function HangingPanel({
  tasks,
  today,
  cell,
  catMap,
  onCollapse,
  onOpenTask,
}: {
  tasks: TaskRow[]
  today: DateStr
  cell: number
  catMap: ReadonlyMap<string, CategoryRow>
  onCollapse: () => void
  onOpenTask: (id: string) => void
}) {
  // Ctrl/Cmd+клик добирает в выделение — разбирать пачками быстрее.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const selectedId = selected.size === 1 ? [...selected][0]! : null
  const [wipeArmed, setWipeArmed] = useState(false)
  const [similarArmed, setSimilarArmed] = useState(false)
  // «Похожие» — просроченные с теми же названиями, что у выделенных.
  const similarTitles = new Set([...selected].map((id) => tasks.find((t) => t.id === id)?.title).filter(Boolean))
  const similar = tasks.filter((t) => similarTitles.has(t.title))
  const dateInput = useRef<HTMLInputElement>(null)

  const ordered = [...tasks].sort((a, b) =>
    naturalCompare(
      { urgency: effectiveUrgency(a, today), importance: a.importance },
      { urgency: effectiveUrgency(b, today), importance: b.importance },
    ),
  )

  const items: BoardItem[] = ordered.map((t) => ({
    id: t.id,
    importance: t.importance,
    content: (
      <button
        type="button"
        className="block h-full w-full text-left"
        style={{
          opacity: selected.size > 0 && !selected.has(t.id) ? 0.55 : 1,
          transition: 'opacity 150ms ease',
        }}
        onClick={(e) => {
          setSelected((prev) => {
            const next = new Set(e.ctrlKey || e.metaKey ? prev : [])
            if (prev.has(t.id) && (e.ctrlKey || e.metaKey || prev.size === 1)) next.delete(t.id)
            else next.add(t.id)
            return next
          })
        }}
      >
        <Tile tile={toTileData(t, today, catMap)} style={{ height: '100%' }} />
      </button>
    ),
  }))

  const act = async (fn: (id: string) => Promise<void>) => {
    for (const id of selected) await fn(id)
    setSelected(new Set())
  }

  return (
    <div className="mt-1">
      <div className="mb-1.5 flex items-center justify-between pt-1">
        <span>
          <span className="text-13 font-medium text-text">Просроченные задачи · {tasks.length}</span>
          <span className="ml-2 hidden font-mono text-11 text-text-quiet sm:inline">не сделаны в свой день</span>
        </span>
        <button
          type="button"
          onClick={onCollapse}
          className="flex h-[30px] items-center rounded-tile bg-surface2 px-3 text-[12px] text-text"
        >
          Свернуть
        </button>
      </div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        <Chip
          disabled={!selectedId}
          onClick={() => {
            if (selectedId) {
              onOpenTask(selectedId)
              setSelected(new Set())
            }
          }}
        >
          Открыть
        </Chip>
        <Chip
          disabled={selected.size === 0}
          onClick={() => act((id) => moveTaskToDay(id, today, today))}
        >
          В сегодня
        </Chip>
        <Chip disabled={selected.size === 0} onClick={() => dateInput.current?.showPicker()}>
          На дату
        </Chip>
        <Chip muted disabled={selected.size === 0} onClick={() => act((id) => softDeleteTask(id))}>
          Удалить
        </Chip>
        <Chip
          muted
          disabled={selected.size === 0}
          onClick={() => {
            if (!similarArmed) {
              setSimilarArmed(true)
              setTimeout(() => setSimilarArmed(false), 3000)
              return
            }
            setSimilarArmed(false)
            for (const t of similar) void softDeleteTask(t.id)
            setSelected(new Set())
          }}
        >
          {similarArmed ? `Точно удалить ${similar.length} похожих` : 'Удалить похожие'}
        </Chip>
        <span className="ml-1 self-center font-mono text-[10px] text-text-quiet">
          {selected.size > 1
            ? `выбрано ${selected.size} · ctrl+клик добирает`
            : selected.size === 1
              ? 'действия по выбранной · ctrl+клик добирает'
              : 'выберите плитку'}
        </span>
        <button
          type="button"
          onClick={() => {
            if (!wipeArmed) {
              setWipeArmed(true)
              setTimeout(() => setWipeArmed(false), 3000)
              return
            }
            setWipeArmed(false)
            for (const t of tasks) void softDeleteTask(t.id)
          }}
          className="ml-auto flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-tile px-3 text-[12px]"
          style={{
            background: 'var(--surface2)',
            color: wipeArmed ? 'var(--accent-alt)' : 'var(--text-muted)',
          }}
        >
          {wipeArmed ? `Точно удалить все ${tasks.length}` : 'Удалить все'}
        </button>
        <input
          ref={dateInput}
          type="date"
          className="sr-only"
          min={today}
          onChange={(e) => {
            const d = e.target.value
            if (d) void act((id) => moveTaskToDay(id, d, today))
            e.target.value = ''
          }}
        />
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: '45dvh' }}>
        <Board items={items} cell={cell} />
      </div>
    </div>
  )
}

function Chip({
  children,
  onClick,
  disabled,
  muted,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  muted?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-tile bg-surface2 px-3 text-[12px] ${
        muted ? 'text-text-muted' : 'text-text'
      } disabled:opacity-50`}
    >
      {children}
    </button>
  )
}
