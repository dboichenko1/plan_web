// Экран «Месяц»: календарная сетка, где каждая клетка — миниатюра
// борда дня. Та же укладка packDay, что и на дне, только плитки уменьшены до
// заливок без текста — серые слетевшие дни видны в мозаике честно.

import { useMemo, useState, type ReactNode } from 'react'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import type { CategoryRow, TaskRow } from '../data/contract'
import { addDays, daysInMonth, isoWeekday } from '../domain/date'
import { packDay } from '../domain/packing'
import { naturalCompare } from '../domain/ordering'
import { taskState } from '../domain/state'
import { effectiveUrgency } from '../domain/urgency'
import type { DateStr } from '../domain/types'
import { Board, useCellSize, type BoardItem } from '../ui/Board'
import { Tile, tileFill } from '../ui/Tile'
import { WEEKDAYS_SHORT, dateLong } from '../ui/format'
import { toTileData } from '../ui/taskTile'
import { IconChevronLeft, IconChevronRight } from '../ui/icons'

const MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
] as const

/** 'YYYY-MM' ± delta месяцев — арифметика над строкой, без Date. */
function addMonths(month: string, delta: number): string {
  const total = Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1) + delta
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`
}

export function MonthScreen({
  userId,
  today,
  month,
  onMonthChange,
  onOpenDay,
}: {
  userId: string
  today: DateStr
  month: string /* 'YYYY-MM' */
  onMonthChange: (m: string) => void
  onOpenDay: (day: DateStr) => void
}) {
  const year = Number(month.slice(0, 4))
  const monthNum = Number(month.slice(5, 7))
  const first: DateStr = `${month}-01`
  const last: DateStr = `${month}-${String(daysInMonth(year, monthNum)).padStart(2, '0')}`

  // Один живой запрос на весь месяц; группировка по дням — в памяти.
  const tasks = useLive(
    () =>
      db.tasks
        .where('scheduled_on')
        .between(first, last, true, true)
        .and((t) => t.user_id === userId && !t.deleted_at)
        .toArray(),
    [first, last, userId],
  )

  const byDay = useMemo(() => {
    const map = new Map<string, TaskRow[]>()
    for (const t of tasks ?? []) {
      if (!t.scheduled_on) continue
      const list = map.get(t.scheduled_on)
      if (list) list.push(t)
      else map.set(t.scheduled_on, [t])
    }
    // Как на борде дня: открытые по порядку, выполненные — в хвосте мозаики.
    for (const list of map.values()) {
      list.sort((a, b) =>
        a.status === b.status ? a.order_index - b.order_index : a.status === 'done' ? 1 : -1,
      )
    }
    return map
  }, [tasks])

  let doneCount = 0
  let slippedCount = 0
  for (const t of tasks ?? []) {
    const s = taskState(t, today)
    if (s === 'done') doneCount++
    else if (s !== 'live') slippedCount++
  }

  // Сетка недель: пн..вс, хвосты соседних месяцев — приглушённые пустые клетки.
  const leading = isoWeekday(first) - 1
  const total = daysInMonth(year, monthNum)
  const rows = Math.ceil((leading + total) / 7)
  const cells: (DateStr | null)[] = Array.from({ length: rows * 7 }, (_, i) => {
    const n = i - leading
    return n >= 0 && n < total ? addDays(first, n) : null
  })

  const { ref, cell, width } = useCellSize(7)
  const cellH = Math.round(cell * 1.1)
  const [mode, setMode] = useState<'grid' | 'canvas'>('grid')
  const categories = useLive(() => db.categories.toArray(), [userId])
  const catMap = useMemo(
    () => new Map<string, CategoryRow>((categories ?? []).map((c) => [c.id, c])),
    [categories],
  )
  // Полотно месяца: все открытые задачи одной мозаикой, горячее сверху.
  const canvasCell = Math.min(89, Math.floor((width - 3 * 4) / 4))
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

  return (
    <div className="flex h-full flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="shrink-0 px-3 pt-1.5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-tile text-24 font-semibold leading-[1.1] text-text">
              {MONTHS_NOM[monthNum - 1] ?? ''}
            </h1>
            <div className="mt-0.5 font-mono text-11 text-text-quiet">
              {year}
              {doneCount > 0 && ` · сделано ${doneCount}`}
              {slippedCount > 0 && ` · слетело ${slippedCount}`}
            </div>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMode(mode === 'grid' ? 'canvas' : 'grid')}
              className="flex h-[34px] items-center rounded-tile bg-surface px-3 text-13 text-text-muted"
            >
              {mode === 'grid' ? 'полотно' : 'сетка'}
            </button>
            {month !== today.slice(0, 7) && (
              <button
                type="button"
                onClick={() => onMonthChange(today.slice(0, 7))}
                className="flex h-[34px] items-center rounded-tile bg-surface px-3 text-13 text-text-muted"
              >
                сегодня
              </button>
            )}
            <HeaderButton label="Предыдущий месяц" onClick={() => onMonthChange(addMonths(month, -1))}>
              <IconChevronLeft size={15} />
            </HeaderButton>
            <HeaderButton label="Следующий месяц" onClick={() => onMonthChange(addMonths(month, 1))}>
              <IconChevronRight size={15} />
            </HeaderButton>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div ref={ref} className="pt-3.5">
          <div style={{ width, margin: '0 auto' }}>
            {mode === 'canvas' ? (
              <>
                <Board items={canvasItems} cell={canvasCell} animate={false} />
                {canvasItems.length === 0 && (
                  <p className="pt-20 text-center text-15 text-text-muted">В этом месяце пусто.</p>
                )}
                <div className="pt-2 font-mono text-11 text-text-quiet">
                  все открытые задачи месяца · горячее сверху · тап открывает день
                </div>
              </>
            ) : (
            <>
            <div className="flex gap-1">
              {WEEKDAYS_SHORT.map((wd) => (
                <span
                  key={wd}
                  className="text-center font-mono text-11 text-text-quiet"
                  style={{ width: cell }}
                >
                  {wd}
                </span>
              ))}
            </div>

            <div className="mt-1.5 flex flex-wrap gap-1">
              {cells.map((day, i) =>
                day === null ? (
                  <div
                    key={`x${i}`}
                    aria-hidden
                    className="rounded-tile bg-surface"
                    style={{ width: cell, height: cellH, opacity: 0.35 }}
                  />
                ) : (
                  <DayCell
                    key={day}
                    day={day}
                    tasks={byDay.get(day) ?? []}
                    isToday={day === today}
                    today={today}
                    cell={cell}
                    height={cellH}
                    onOpen={() => onOpenDay(day)}
                  />
                ),
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <LegendDot fill="var(--u4)" label="горит" />
              <LegendDot fill="var(--u3)" label="скоро" />
              <LegendDot fill="var(--u2)" label="на неделе" />
              <LegendDot fill="var(--slipped-fill)" label="слетело" />
              <LegendDot fill="var(--done-fill)" label="сделано" />
            </div>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const PAD = 4 // внутренний отступ клетки

function DayCell({
  day,
  tasks,
  isToday,
  today,
  cell,
  height,
  onOpen,
}: {
  day: DateStr
  tasks: TaskRow[]
  isToday: boolean
  today: DateStr
  cell: number
  height: number
  onOpen: () => void
}) {
  // Масштаб миниатюры: четыре колонки борда в ширину клетки.
  const unit = (cell - PAD * 2) / 4
  const placements = packDay(tasks.map((t) => ({ id: t.id, importance: t.importance })))
  const rowCount = placements.reduce((m, p) => Math.max(m, p.row + p.h), 0)
  const fills = new Map(
    tasks.map((t) => [t.id, tileFill({ state: taskState(t, today), urgency: effectiveUrgency(t, today) })]),
  )

  return (
    <button
      type="button"
      aria-label={dateLong(day)}
      onClick={onOpen}
      className="relative overflow-hidden rounded-tile bg-surface"
      style={{ width: cell, height }}
    >
      {/* Мозаика прижата к низу клетки; при переполнении верх обрезается. */}
      <div
        className="absolute"
        style={{ left: PAD, right: PAD, bottom: PAD, height: rowCount * unit }}
      >
        {placements.map((p) => (
          <span
            key={p.id}
            className="absolute block"
            style={{
              left: p.col * unit,
              top: p.row * unit,
              width: p.w * unit - 1,
              height: p.h * unit - 1,
              borderRadius: 1,
              background: fills.get(p.id),
            }}
          />
        ))}
      </div>
      <span
        className={`absolute font-mono text-11 ${isToday ? 'font-semibold text-text' : 'text-text-quiet'}`}
        style={{ top: 2, right: 5 }}
      >
        {Number(day.slice(8, 10))}
      </span>
    </button>
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

function LegendDot({ fill, label }: { fill: string; label: string }) {
  return (
    <span className="flex items-center gap-[5px]">
      <span className="h-[9px] w-[9px]" style={{ background: fill, borderRadius: 1 }} />
      <span className="font-mono text-11 text-text-quiet">{label}</span>
    </span>
  )
}
