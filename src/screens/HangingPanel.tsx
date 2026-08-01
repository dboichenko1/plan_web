// Развёрнутая полоса «Висят» (макет 04) — ключевой экран идеи: серые плитки
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
}: {
  tasks: TaskRow[]
  today: DateStr
  cell: number
  catMap: ReadonlyMap<string, CategoryRow>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
          opacity: selectedId && selectedId !== t.id ? 0.55 : 1,
          transition: 'opacity 150ms ease',
        }}
        onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}
      >
        <Tile tile={toTileData(t, today, catMap)} style={{ height: '100%' }} />
      </button>
    ),
  }))

  const act = async (fn: (id: string) => Promise<void>) => {
    if (!selectedId) return
    await fn(selectedId)
    setSelectedId(null)
  }

  return (
    <div className="mt-1">
      <Board items={items} cell={cell} />
      <div className="mt-1.5 flex items-center gap-1">
        <Chip
          disabled={!selectedId}
          onClick={() => act((id) => moveTaskToDay(id, today, today))}
        >
          В сегодня
        </Chip>
        <Chip disabled={!selectedId} onClick={() => dateInput.current?.showPicker()}>
          На дату
        </Chip>
        <Chip muted disabled={!selectedId} onClick={() => act((id) => softDeleteTask(id))}>
          Удалить
        </Chip>
        <span className="ml-1 self-center font-mono text-[10px] text-text-quiet">
          {selectedId ? 'действия по выбранной' : 'выберите плитку'}
        </span>
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
      className={`flex h-[30px] items-center rounded-tile bg-surface2 px-3 text-[12px] ${
        muted ? 'text-text-muted' : 'text-text'
      } disabled:opacity-50`}
    >
      {children}
    </button>
  )
}
