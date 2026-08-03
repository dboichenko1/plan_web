import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import type { CategoryRow, TaskRow } from '../data/contract'
import { completeTask, placeTaskInDay } from '../data/repo'
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
import { parseSlotId, slotId, useBoardSensors, type DragData } from '../ui/dnd'
import { IconChevronDown, IconChevronLeft, IconChevronRight, IconInbox, IconSettings } from '../ui/icons'
import { useSwipeNav } from '../ui/useSwipeNav'
import { HangingPanel } from './HangingPanel'
import { InboxScreen } from './InboxScreen'

const GHOST_ID = '__ghost__'

export function DayScreen({
  userId,
  today,
  day,
  onDayChange,
  onOpenTask,
  inboxOpen,
  onCloseInbox,
  onToggleInbox,
  hangingOpen,
  onToggleHanging,
  onOpenSettings,
  cols = 4,
}: {
  userId: string
  today: DateStr
  day: DateStr
  onDayChange: (d: DateStr) => void
  onOpenTask: (id: string) => void
  inboxOpen: boolean
  onCloseInbox: () => void
  onToggleInbox: () => void
  hangingOpen: boolean
  onToggleHanging: () => void
  onOpenSettings?: () => void
  /** Колонок на борде: 4 на телефоне, 8 в раскладке мака. Ячейка не растёт. */
  cols?: number
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
    .sort((a, b) => ((a.completed_at ?? '') < (b.completed_at ?? '') ? 1 : -1))

  const { ref, cell, width } = useCellSize(cols)

  // Перетаскивание: призрак занимает место приземления, соседи разъезжаются.
  const sensors = useBoardSensors()
  const [dragging, setDragging] = useState<DragData | null>(null)
  const [ghostIndex, setGhostIndex] = useState<number | 'end' | null>(null)
  const [inboxThird, setInboxThird] = useState(false)

  const visibleOpen = dragging ? open.filter((t) => t.id !== dragging.task.id) : open

  const items: BoardItem[] = visibleOpen.map((t, i) => ({
    id: t.id,
    importance: t.importance,
    content: (
      <BoardTile
        index={i}
        task={t}
        today={today}
        catMap={catMap}
        dragActive={dragging !== null}
        onOpen={() => onOpenTask(t.id)}
      />
    ),
  }))
  if (dragging && ghostIndex !== null) {
    const ghost: BoardItem = {
      id: GHOST_ID,
      importance: dragging.task.importance,
      content: (
        <div
          className="h-full w-full rounded-tile"
          style={{ border: '1px dashed var(--text-quiet)' }}
        />
      ),
    }
    if (ghostIndex === 'end') items.push(ghost)
    else items.splice(Math.min(ghostIndex, items.length), 0, ghost)
  }

  const collision: CollisionDetection = (args) => {
    const within = pointerWithin(args)
    return within.length > 0 ? within : closestCenter(args)
  }

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData | undefined
    if (!data) return
    setDragging(data)
    if (data.type === 'inbox-row') setInboxThird(true)
  }

  const onDragOver = (e: DragOverEvent) => {
    const over = e.over?.id
    if (typeof over === 'string') {
      const slot = parseSlotId(over)
      if (slot !== null && (slot === 'end' || slot >= 0)) setGhostIndex(slot)
    }
  }

  const reset = () => {
    setDragging(null)
    setGhostIndex(null)
    setInboxThird(false)
  }

  const onDragEnd = (e: DragEndEvent) => {
    const data = e.active.data.current as DragData | undefined
    const index = ghostIndex
    if (data && index !== null) {
      const at = index === 'end' ? visibleOpen.length : index
      void placeTaskInDay(data.task.id, day, at, userId)
      if (data.type === 'inbox-row') onCloseInbox()
    }
    reset()
  }

  const occupied = occupiedCells(
    open.map((t) => ({ importance: t.importance, state: taskState(t, today) })),
  )
  const capacity = profile?.day_capacity ?? 32
  const hanging = (hangingTasks ?? []).sort(
    (a, b) => effectiveUrgency(b, today) - effectiveUrgency(a, today),
  )

  const swipe = useSwipeNav(() => onDayChange(addDays(day, -1)), () => onDayChange(addDays(day, 1)))

  const overlaySize = dragging
    ? {
        width: TILE[dragging.task.importance].w * cell + (TILE[dragging.task.importance].w - 1) * GAP,
        height: TILE[dragging.task.importance].h * cell + (TILE[dragging.task.importance].h - 1) * GAP,
      }
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <div
        className="relative flex h-full flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        onTouchStart={swipe.onTouchStart}
        onTouchEnd={swipe.onTouchEnd}
      >
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
              {day !== today && (
                <button
                  type="button"
                  onClick={() => onDayChange(today)}
                  className="flex h-[34px] items-center rounded-tile bg-surface px-2.5 text-13 text-text-muted"
                >
                  сегодня
                </button>
              )}
              <HeaderButton
                label="Задачи без даты"
                onClick={() => {
                  setInboxThird(false)
                  onToggleInbox()
                }}
              >
                <IconInbox size={15} />
              </HeaderButton>
              <HeaderButton label="Предыдущий день" onClick={() => onDayChange(addDays(day, -1))}>
                <IconChevronLeft size={15} />
              </HeaderButton>
              <HeaderButton label="Следующий день" onClick={() => onDayChange(addDays(day, 1))}>
                <IconChevronRight size={15} />
              </HeaderButton>
              {onOpenSettings && (
                <HeaderButton label="Настройки" onClick={onOpenSettings}>
                  <IconSettings size={15} />
                </HeaderButton>
              )}
            </div>
          </div>

          {day === today && hanging.length > 0 && (
            <button
              type="button"
              onClick={onToggleHanging}
              className="mt-2.5 flex h-[34px] w-full items-center justify-between rounded-tile bg-surface px-3"
            >
              <span className="flex items-center gap-2.5">
                <span className="text-13 text-text">Просроченные</span>
                <span className="font-mono text-13 text-text-muted">{hanging.length}</span>
                {!hangingOpen && (
                  <span className="flex gap-[3px]">
                    {hanging.slice(0, 8).map((t) => (
                      <span
                        key={t.id}
                        className="h-[5px] w-[5px]"
                        style={{ background: `var(--u${effectiveUrgency(t, today)})` }}
                      />
                    ))}
                  </span>
                )}
              </span>
              <span
                className="text-text-quiet"
                style={{
                  transform: hangingOpen ? 'rotate(180deg)' : undefined,
                  transition: 'transform 150ms',
                }}
              >
                <IconChevronDown size={14} />
              </span>
            </button>
          )}

          {day === today && hangingOpen && hanging.length > 0 && (
            <HangingPanel tasks={hanging} today={today} cell={cell} catMap={catMap} onCollapse={onToggleHanging} onOpenTask={onOpenTask} />
          )}

          <div className="mt-2.5">
            <CapacityBar occupied={occupied} capacity={capacity} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <div ref={ref} className="pt-2.5">
            <div style={{ width, margin: '0 auto' }}>
              {items.length === 0 && done.length === 0 ? (
                <EmptyDay />
              ) : (
                <BoardWithEndSlot items={items} cell={cell} cols={cols} />
              )}
              {dragging?.type === 'board-tile' && (
                // Активный draggable обязан оставаться смонтированным: из укладки
                // плитка исключена, но узел живёт скрыто — иначе dnd-kit теряет
                // active, dragEnd не приходит и перетаскивание зависает.
                <div className="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden>
                  <BoardTile
                    index={-1}
                    task={dragging.task}
                    today={today}
                    catMap={catMap}
                    dragActive
                    onOpen={() => {}}
                  />
                </div>
              )}
            </div>
          </div>

          {done.length > 0 && (
            <div className="pt-2.5" style={{ width, margin: '0 auto' }}>
              <div className="mb-[5px] font-mono text-11 text-text-quiet">
                сделано · {done.length}
              </div>
              <div className="flex flex-wrap gap-1">
                {done.map((t) => (
                  <DoneTile
                    key={t.id}
                    task={t}
                    cell={cell}
                    today={today}
                    catMap={catMap}
                    onOpen={onOpenTask}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {inboxOpen && (
          <div
            className="absolute inset-x-0 bottom-0 z-10 overflow-hidden bg-bg"
            style={{
              top: inboxThird ? '58%' : 0,
              borderTop: inboxThird ? '1px solid var(--line)' : undefined,
              transition: 'top 200ms ease',
            }}
          >
            <InboxScreen
              userId={userId}
              today={today}
              onOpenTask={onOpenTask}
              compact={inboxThird}
              draggingId={dragging?.task.id ?? null}
            />
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && overlaySize && (
          <div style={{ ...overlaySize, transform: 'scale(1.04) rotate(-2deg)' }}>
            <Tile tile={toTileData(dragging.task, today, catMap)} style={{ height: '100%' }} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/** Борд + невидимая зона «в конец» под ним. */
function BoardWithEndSlot({ items, cell, cols }: { items: BoardItem[]; cell: number; cols: number }) {
  const { setNodeRef } = useDroppable({ id: slotId('end') })
  return (
    <div ref={setNodeRef} className="pb-6">
      <Board items={items} cols={cols} cell={cell} />
    </div>
  )
}

function BoardTile({
  index,
  task,
  today,
  catMap,
  dragActive,
  onOpen,
}: {
  index: number
  task: TaskRow
  today: DateStr
  catMap: ReadonlyMap<string, CategoryRow>
  dragActive: boolean
  onOpen: () => void
}) {
  const { setNodeRef: setDropRef } = useDroppable({ id: slotId(index) })
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: `drag:${task.id}`,
    data: { type: 'board-tile', task } satisfies DragData,
  })

  // Свайп вправо — выполнено. Быстрый горизонтальный жест не успевает
  // активировать перетаскивание (у него задержка 200 мс).
  const swipe = useRef<{ x: number; y: number; captured: boolean } | null>(null)
  const [dx, setDx] = useState(0)
  // Быстрый свайп отпускается раньше, чем React дорендерит dx — актуальное
  // значение живёт в ref.
  const dxRef = useRef(0)
  const [completing, setCompleting] = useState(false)

  const state = taskState(task, today)
  const canComplete = state !== 'done'

  return (
    <div ref={setDropRef} className="h-full w-full" data-noswipe>
      <div
        ref={setDragRef}
        {...attributes}
        className="relative h-full w-full overflow-hidden rounded-tile"
        style={{ touchAction: 'none', opacity: isDragging ? 0 : 1 }}
        onPointerDown={(e) => {
          // Сначала dnd-kit (долгое нажатие), поверх — свайп: быстрый
          // горизонтальный жест не успевает активировать перетаскивание.
          ;(listeners?.onPointerDown as ((ev: unknown) => void) | undefined)?.(e)
          if (!canComplete || dragActive) return
          swipe.current = { x: e.clientX, y: e.clientY, captured: false }
        }}
        onPointerMove={(e) => {
          const s = swipe.current
          if (!s || dragActive) return
          const ddx = e.clientX - s.x
          const ddy = e.clientY - s.y
          if (!s.captured) {
            if (ddx < 10 || Math.abs(ddx) < Math.abs(ddy) * 1.4) return
            s.captured = true
          }
          dxRef.current = Math.max(0, ddx)
          setDx(dxRef.current)
        }}
        onPointerUp={(e) => {
          const s = swipe.current
          swipe.current = null
          if (!s) return
          if (!s.captured) {
            if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6 && !dragActive) onOpen()
            dxRef.current = 0
            setDx(0)
            return
          }
          if (dxRef.current > 90) {
            // Заливка своим цветом слева направо, затем гаснет и уезжает в «Сделано».
            setCompleting(true)
            setTimeout(() => void completeTask(task.id, today), 200)
          }
          dxRef.current = 0
          setDx(0)
        }}
        onPointerCancel={() => {
          swipe.current = null
          dxRef.current = 0
          setDx(0)
        }}
      >
        <div
          className="h-full w-full"
          style={{
            transform: dx > 0 ? `translateX(${Math.min(dx, 120)}px)` : undefined,
            transition: dx === 0 ? 'transform 180ms ease' : undefined,
          }}
        >
          <Tile tile={toTileData(task, today, catMap)} style={{ height: '100%' }} />
        </div>
        {completing && (
          <div
            className="absolute inset-0 rounded-tile"
            style={{
              background: `var(--u${effectiveUrgency(task, today)})`,
              animation: 'sweep-in 200ms ease forwards',
            }}
          />
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
  children: ReactNode
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

function EmptyDay() {
  return (
    <div className="pt-24 text-center">
      <p className="text-15 text-text-muted">На сегодня пусто.</p>
      <p className="mt-1 text-13 text-text-quiet">
        Добавьте задачу или перетащите из «Без даты».
      </p>
    </div>
  )
}

export function useSelectedDay(today: DateStr): [DateStr, (d: DateStr) => void] {
  const [day, setDay] = useState<DateStr | null>(null)
  return [day ?? today, setDay]
}
