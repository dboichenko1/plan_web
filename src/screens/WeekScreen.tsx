// Экран недели: семь горизонтальных полос, по одной на день. Полоса — та же
// мозаика packDay, что и борд дня, только в масштабе 0.5 и растущая вправо,
// поэтому по неделе сразу видно, где день перегружен и где посыпалось.

import { useMemo, useState, type ReactNode } from 'react'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import type { CategoryRow, TaskRow } from '../data/contract'
import { addDays, daysBetween, isoWeekday } from '../domain/date'
import { COLS, TILE, occupiedCells, packDay } from '../domain/packing'
import { naturalCompare } from '../domain/ordering'
import { effectiveUrgency } from '../domain/urgency'
import { Tile } from '../ui/Tile'
import { toTileData } from '../ui/taskTile'
import { taskState } from '../domain/state'
import type { DateStr } from '../domain/types'
import { Board, useCellSize, type BoardItem } from '../ui/Board'
import { tileFill, tileTextColor, type TileData } from '../ui/Tile'
import { dateShort, weekdayShort } from '../ui/format'
import { CategoryIcon, IconChevronLeft, IconChevronRight } from '../ui/icons'

/** Зазор между мини-плитками — по дизайну px, вдвое меньше зазора борда дня. */
const MINI_GAP = 2

export function WeekScreen({
  userId,
  today,
  weekStart,
  onWeekChange,
  onOpenDay,
  onOpenPeriod,
}: {
  userId: string
  today: DateStr
  weekStart: DateStr
  onWeekChange: (monday: DateStr) => void
  onOpenDay: (day: DateStr) => void
  onOpenPeriod?: () => void
}) {
  const weekEnd = addDays(weekStart, 6)

  // Один запрос на всю неделю: строки 'YYYY-MM-DD' сравниваются лексикографически,
  // поэтому between по датам работает; листание дней внутри недели базу не трогает.
  const tasks = useLive(
    () =>
      db.tasks
        .where('scheduled_on')
        .between(weekStart, weekEnd, true, true)
        .and((t) => t.user_id === userId && !t.deleted_at)
        .toArray(),
    [weekStart, userId],
  )
  const categories = useLive(() => db.categories.toArray(), [userId])
  const profile = useLive(() => db.profiles.get(userId), [userId])

  const catMap = useMemo(
    () => new Map<string, CategoryRow>((categories ?? []).map((c) => [c.id, c])),
    [categories],
  )

  // Задачи по дням: открытые в порядке укладки, выполненные — серым хвостом
  // после них. День остаётся честной записью того, что было.
  const byDay = useMemo(() => {
    const m = new Map<DateStr, TaskRow[]>()
    for (const t of tasks ?? []) {
      if (!t.scheduled_on) continue
      const list = m.get(t.scheduled_on)
      if (list) list.push(t)
      else m.set(t.scheduled_on, [t])
    }
    for (const [day, list] of m) {
      const open = list
        .filter((t) => t.status === 'open')
        .sort((a, b) => a.order_index - b.order_index)
      const done = list
        .filter((t) => t.status === 'done')
        .sort((a, b) => ((a.completed_at ?? '') < (b.completed_at ?? '') ? 1 : -1))
      m.set(day, [...open, ...done])
    }
    return m
  }, [tasks])

  const { ref, cell } = useCellSize(COLS)
  // Ячейка недели — половина ячейки борда дня.
  const mini = Math.floor(cell / 2)

  const [mode, setMode] = useState<'days' | 'canvas'>('days')
  const baseDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  // Сегодняшняя полоса — первой, остальные по порядку дат.
  const days = baseDays.includes(today) ? [today, ...baseDays.filter((d) => d !== today)] : baseDays

  // Полотно недели: все открытые задачи одной мозаикой, горячее сверху.
  const canvasItems: BoardItem[] = useMemo(() => {
    const open = (tasks ?? [])
      .filter((t) => t.status === 'open')
      .sort((a, b) =>
        naturalCompare(
          { urgency: effectiveUrgency(a, today), importance: a.importance },
          { urgency: effectiveUrgency(b, today), importance: b.importance },
        ),
      )
    return open.map((t) => ({
      id: t.id,
      importance: t.importance,
      content: (
        <button
          type="button"
          className="block h-full w-full text-left"
          onClick={() => t.scheduled_on && onOpenDay(t.scheduled_on)}
        >
          <Tile tile={toTileData(t, today, catMap)} style={{ height: '100%' }} />
        </button>
      ),
    }))
  }, [tasks, today, catMap, onOpenDay])
  const currentMonday = addDays(today, -(isoWeekday(today) - 1))
  const capacity = profile?.day_capacity ?? 32

  return (
    <div className="flex h-full flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="shrink-0 px-3 pt-1.5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-tile text-24 font-semibold leading-[1.1] text-text">
              Неделя {isoWeekNumber(weekStart)}
            </h1>
            <div className="mt-0.5 font-mono text-11 text-text-quiet">
              {rangeLabel(weekStart, weekEnd)}
            </div>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMode(mode === 'days' ? 'canvas' : 'days')}
              className="flex h-[34px] items-center rounded-tile bg-surface px-3 text-13 text-text-muted"
            >
              {mode === 'days' ? 'полотно' : 'по дням'}
            </button>
            {onOpenPeriod && (
              <button
                type="button"
                onClick={onOpenPeriod}
                className="flex h-[34px] items-center rounded-tile bg-surface px-3 text-13 text-text-muted"
              >
                период
              </button>
            )}
            {weekStart !== currentMonday && (
              <button
                type="button"
                onClick={() => onWeekChange(currentMonday)}
                className="flex h-[34px] items-center rounded-tile bg-surface px-3 text-13 text-text-muted"
              >
                сегодня
              </button>
            )}
            <HeaderButton label="Предыдущая неделя" onClick={() => onWeekChange(addDays(weekStart, -7))}>
              <IconChevronLeft size={15} />
            </HeaderButton>
            <HeaderButton label="Следующая неделя" onClick={() => onWeekChange(addDays(weekStart, 7))}>
              <IconChevronRight size={15} />
            </HeaderButton>
          </div>
        </div>
      </header>

      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {mode === 'canvas' ? (
          <div className="pt-2.5">
            <Board items={canvasItems} cell={cell} animate={false} />
            {canvasItems.length === 0 && (
              <p className="pt-20 text-center text-15 text-text-muted">На этой неделе пусто.</p>
            )}
            <div className="pt-2 font-mono text-11 text-text-quiet">
              все открытые задачи недели · горячее сверху · тап открывает день
            </div>
          </div>
        ) : (
        <div className="flex flex-col gap-1 pt-2.5">
          {days.map((day) => (
            <DayStrip
              key={day}
              day={day}
              today={today}
              tasks={byDay.get(day) ?? []}
              catMap={catMap}
              mini={mini}
              capacity={capacity}
              onOpen={onOpenDay}
            />
          ))}
        </div>
        )}
        {mode === 'days' && (
          <div className="pt-2 font-mono text-11 text-text-quiet">
            полоса скроллится вбок · серое в прошедших днях — что посыпалось
          </div>
        )}
      </div>
    </div>
  )
}

function DayStrip({
  day,
  today,
  tasks,
  catMap,
  mini,
  capacity,
  onOpen,
}: {
  day: DateStr
  today: DateStr
  tasks: TaskRow[]
  catMap: ReadonlyMap<string, CategoryRow>
  mini: number
  capacity: number
  onOpen: (day: DateStr) => void
}) {
  const isToday = day === today
  const byId = new Map(tasks.map((t) => [t.id, t]))

  // Колонок даём с запасом — суммарную ширину плиток: тогда first-fit из packDay
  // гарантированно укладывает всё в два ряда, и полоса растёт вправо, а не вниз.
  const totalW = tasks.reduce((s, t) => s + TILE[t.importance].w, 0)
  const placements = packDay(
    tasks.map((t) => ({ id: t.id, importance: t.importance })),
    Math.max(COLS, totalW),
  )
  const usedCols = placements.reduce((m, p) => Math.max(m, p.col + p.w), 0)
  const px = (n: number) => n * (mini + MINI_GAP)
  // Высота полосы всегда два ряда — пустой день не схлопывается.
  const bandH = px(2) - MINI_GAP

  const occupied = occupiedCells(
    tasks
      .filter((t) => t.status === 'open')
      .map((t) => ({ importance: t.importance, state: taskState(t, today) })),
  )
  const capColor = occupied > capacity ? 'var(--accent-alt)' : 'var(--text-quiet)'
  const ratio = capacity > 0 ? Math.min(1, occupied / capacity) : 1

  return (
    <div
      className="relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-tile"
      style={{
        background: isToday ? 'var(--surface)' : undefined,
        padding: '8px 10px 8px 12px',
      }}
      onClick={() => onOpen(day)}
    >
      {isToday && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: 'var(--text)' }} />
      )}

      <button
        type="button"
        aria-label={`Открыть ${dateShort(day)}`}
        className="w-8 shrink-0 text-left"
        onClick={(e) => {
          // Кнопка внутри кликабельной полосы — не даём событию сработать дважды.
          e.stopPropagation()
          onOpen(day)
        }}
      >
        <span
          className="block font-mono text-11"
          style={{ color: isToday ? 'var(--text-muted)' : 'var(--text-quiet)' }}
        >
          {weekdayShort(day)}
        </span>
        <span
          className="block font-mono text-18 font-medium"
          style={{ color: isToday ? 'var(--text)' : day < today ? 'var(--text-quiet)' : 'var(--text-muted)' }}
        >
          {Number(day.slice(8, 10))}
        </span>
      </button>

      <div className="min-w-0 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div
          className="relative"
          style={{ width: usedCols === 0 ? 0 : px(usedCols) - MINI_GAP, height: bandH }}
        >
          {placements.map((p) => {
            const task = byId.get(p.id)
            if (!task) return null
            const w = p.w * mini + (p.w - 1) * MINI_GAP
            return (
              <div
                key={p.id}
                className="absolute"
                style={{
                  left: px(p.col),
                  top: px(p.row),
                  width: w,
                  height: p.h * mini + (p.h - 1) * MINI_GAP,
                }}
              >
                <MiniTile tile={toTileData(task, today, catMap)} width={w} />
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex w-9 shrink-0 flex-col items-end gap-1">
        <span className="font-mono text-11" style={{ color: capColor }}>
          {occupied}/{capacity}
        </span>
        <span className="block h-[3px] w-[26px] overflow-hidden rounded-tile bg-surface2">
          <span
            className="block h-[3px]"
            style={{ width: `${ratio * 100}%`, background: capColor }}
          />
        </span>
      </div>
    </div>
  )
}

/** Плитка в масштабе недели: цвета и состояния те же, что у Tile, текста меньше. */
function MiniTile({ tile, width }: { tile: TileData; width: number }) {
  const expired = tile.state === 'expired'
  // На узкой плитке текст нечитаем — остаются значок и индикатор срочности.
  const showText = width >= 60

  return (
    <div
      className="flex h-full w-full select-none flex-col justify-between overflow-hidden rounded-tile"
      style={{
        background: tileFill(tile),
        color: tileTextColor(tile),
        padding: expired ? 4 : 5,
        border: expired ? '1px solid var(--expired-outline)' : undefined,
      }}
    >
      <div className="flex items-start justify-between">
        <span style={{ opacity: 0.85 }}>
          {tile.categoryIcon && <CategoryIcon icon={tile.categoryIcon} size={10} />}
        </span>
        {tile.state !== 'done' && (
          <span className="flex" style={{ gap: 2, paddingTop: 1 }}>
            {Array.from({ length: tile.urgency }, (_, i) => (
              <span
                key={i}
                style={{
                  width: 3,
                  height: 3,
                  // На серой плитке индикатор хранит исходный цвет срочности.
                  background: tile.state === 'live' ? `var(--on-u${tile.urgency})` : `var(--u${tile.urgency})`,
                }}
              />
            ))}
          </span>
        )}
      </div>
      {showText && (
        <div
          className="font-tile text-11 font-medium"
          style={{
            lineHeight: 1.15,
            ...(tile.importance >= 3
              ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as const,
                  overflow: 'hidden',
                }
              : { whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }),
          }}
        >
          {tile.title}
        </div>
      )}
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

// Номер ISO-недели: неделя принадлежит году своего четверга (ISO 8601).
function isoWeekNumber(monday: DateStr): number {
  const thursday = addDays(monday, 3)
  const jan4: DateStr = `${thursday.slice(0, 4)}-01-04`
  const week1Monday = addDays(jan4, -(isoWeekday(jan4) - 1))
  return Math.floor(daysBetween(week1Monday, thursday) / 7) + 1
}

/** «11–17 авг» внутри одного месяца, «28 июл – 3 авг» на стыке месяцев. */
function rangeLabel(start: DateStr, end: DateStr): string {
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8, 10))}–${dateShort(end)}`
  return `${dateShort(start)} – ${dateShort(end)}`
}
