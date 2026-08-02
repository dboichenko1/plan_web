// Экран «Произвольный период»: пикер диапазона с пресетами
// и дневные полосы. Плитки — мини-блоки в половину недельного масштаба;
// подряд идущие пустые дни свёрнуты в одну тонкую строку
// («2 пустых дня свёрнуты»).

import { useMemo, useState } from 'react'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import type { TaskRow } from '../data/contract'
import { addDays, daysBetween, daysInMonth } from '../domain/date'
import { TILE } from '../domain/packing'
import { taskState } from '../domain/state'
import { effectiveUrgency } from '../domain/urgency'
import type { DateStr } from '../domain/types'
import { tileFill } from '../ui/Tile'
import { DateField as RuDateField } from '../ui/DateField'
import { plural, weekdayShort } from '../ui/format'

/** Жёсткий потолок диапазона: длиннее не рисуем, честно предупреждаем. */
const MAX_DAYS = 92

// Мини-плитка: единица 11px — половина недельного масштаба (там ~22px).
const MINI = 11
const MINI_GAP = 2

type Range = { from: DateStr; to: DateStr }

type Row =
  | { kind: 'day'; day: DateStr; tasks: TaskRow[] }
  | { kind: 'gap'; from: DateStr; count: number }

/** «08.08» — короткая моноширинная подпись дня в полосе. */
function ddmm(d: DateStr): string {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}`
}

function lastNDays(today: DateStr, n: number): Range {
  return { from: addDays(today, -(n - 1)), to: today }
}

/** Календарный квартал, в который попадает today, строковой арифметикой. */
function thisQuarter(today: DateStr): Range {
  const y = Number(today.slice(0, 4))
  const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3)
  const m1 = q * 3 + 1
  const m3 = q * 3 + 3
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    from: `${today.slice(0, 4)}-${pad(m1)}-01`,
    to: `${today.slice(0, 4)}-${pad(m3)}-${pad(daysInMonth(y, m3))}`,
  }
}

export function PeriodScreen({
  userId,
  today,
  onOpenDay,
}: {
  userId: string
  today: string
  onOpenDay: (day: string) => void
}) {
  const [range, setRange] = useState<Range>(() => lastNDays(today, 7))

  const presets = useMemo(
    () => [
      { label: 'последние 7 дней', range: lastNDays(today, 7) },
      { label: 'последние 30', range: lastNDays(today, 30) },
      { label: 'этот квартал', range: thisQuarter(today) },
    ],
    [today],
  )

  // Поля не мешают вводить «от» позже «до» — для выборки концы просто упорядочиваем.
  const lo = range.from <= range.to ? range.from : range.to
  const rawHi = range.from <= range.to ? range.to : range.from
  const tooLong = daysBetween(lo, rawHi) + 1 > MAX_DAYS
  const hi = tooLong ? addDays(lo, MAX_DAYS - 1) : rawHi

  const tasks = useLive(
    () =>
      db.tasks
        .where('scheduled_on')
        .between(lo, hi, true, true)
        .and((t) => t.user_id === userId && !t.deleted_at)
        .toArray(),
    [lo, hi, userId],
  )

  const { rows, emptyDays } = useMemo(() => {
    if (!tasks) return { rows: [] as Row[], emptyDays: 0 }
    const byDay = new Map<DateStr, TaskRow[]>()
    for (const t of tasks) {
      if (!t.scheduled_on) continue
      const list = byDay.get(t.scheduled_on)
      if (list) list.push(t)
      else byDay.set(t.scheduled_on, [t])
    }
    // Внутри дня — открытые по укладке, выполненные хвостом, как на экране дня.
    for (const list of byDay.values()) {
      list.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'open' ? -1 : 1
        if (a.status === 'open') return a.order_index - b.order_index
        return (a.completed_at ?? '') < (b.completed_at ?? '') ? -1 : 1
      })
    }
    const rows: Row[] = []
    let emptyDays = 0
    const total = daysBetween(lo, hi) + 1
    for (let i = 0; i < total; i++) {
      const day = addDays(lo, i)
      const dayTasks = byDay.get(day)
      if (dayTasks && dayTasks.length > 0) {
        rows.push({ kind: 'day', day, tasks: dayTasks })
      } else {
        emptyDays++
        const last = rows[rows.length - 1]
        if (last && last.kind === 'gap') last.count++
        else rows.push({ kind: 'gap', from: day, count: 1 })
      }
    }
    return { rows, emptyDays }
  }, [tasks, lo, hi])

  const dayCount = daysBetween(lo, hi) + 1

  return (
    <div className="flex h-full flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="shrink-0 px-3 pt-1.5">
        <h1 className="font-tile text-24 font-semibold leading-[1.1] text-text">Период</h1>

        <div className="mt-2.5 flex gap-1">
          {presets.map((p) => {
            const active = range.from === p.range.from && range.to === p.range.to
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setRange(p.range)}
                className={`flex h-8 items-center rounded-tile px-3 text-13 ${
                  active ? 'bg-text font-medium text-bg' : 'bg-surface2 text-text'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <div className="mt-2 flex gap-1">
          <DateField
            label="от"
            value={range.from}
            onChange={(v) => setRange((r) => ({ ...r, from: v }))}
          />
          <DateField
            label="до"
            value={range.to}
            onChange={(v) => setRange((r) => ({ ...r, to: v }))}
          />
        </div>

        {tooLong && (
          <div className="mt-2 font-mono text-11 text-accent-alt">
            слишком длинный период — показаны первые {MAX_DAYS} дня
          </div>
        )}

        {tasks && (
          <div className="mt-3.5 flex items-baseline justify-between">
            <span className="text-13 font-medium text-text">
              {dayCount} {plural(dayCount, 'день', 'дня', 'дней')} · {tasks.length}{' '}
              {plural(tasks.length, 'задача', 'задачи', 'задач')}
            </span>
            {emptyDays > 0 && (
              <span className="font-mono text-11 text-text-quiet">
                {emptyDays}{' '}
                {plural(emptyDays, 'пустой день свёрнут', 'пустых дня свёрнуты', 'пустых дней свёрнуто')}
              </span>
            )}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="mt-2 flex flex-col gap-1">
          {rows.map((r) =>
            r.kind === 'day' ? (
              <DayStrip key={r.day} day={r.day} tasks={r.tasks} today={today} onOpen={onOpenDay} />
            ) : (
              <GapStrip key={r.from} from={r.from} count={r.count} onOpen={onOpenDay} />
            ),
          )}
        </div>
      </div>
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: DateStr
  onChange: (v: DateStr) => void
}) {
  return (
    <label className="flex h-11 flex-1 flex-col justify-center rounded-tile border border-line bg-surface px-3 focus-within:border-accent">
      <span className="text-11 leading-none text-text-quiet">{label}</span>
      <RuDateField
        value={value}
        onChange={(v) => {
          if (v) onChange(v)
        }}
        className="text-13 text-text"
      />
    </label>
  )
}

function DayStrip({
  day,
  tasks,
  today,
  onOpen,
}: {
  day: DateStr
  tasks: TaskRow[]
  today: DateStr
  onOpen: (day: string) => void
}) {
  const labelColor =
    day === today ? 'var(--text)' : day < today ? 'var(--text-quiet)' : 'var(--text-muted)'
  return (
    <button
      type="button"
      onClick={() => onOpen(day)}
      className="flex w-full items-center gap-3 overflow-hidden rounded-tile text-left"
      style={{
        minHeight: 40,
        padding: '8px 10px 8px 12px',
        background: day === today ? 'var(--surface2)' : 'var(--surface)',
      }}
    >
      <span className="w-[88px] shrink-0 font-mono text-11" style={{ color: labelColor }}>
        {weekdayShort(day)} {ddmm(day)}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-[2px] overflow-hidden">
        {tasks.map((t) => (
          <MiniTile key={t.id} task={t} today={today} />
        ))}
      </span>
      <span className="shrink-0 font-mono text-11 text-text-quiet">{tasks.length}</span>
    </button>
  )
}

/** Свёрнутые пустые дни: один — «число + прочерк», подряд несколько — группой. */
function GapStrip({
  from,
  count,
  onOpen,
}: {
  from: DateStr
  count: number
  onOpen: (day: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(from)}
      className="flex w-full items-center gap-3 rounded-tile text-left"
      style={{ height: 24, padding: '0 10px 0 12px' }}
    >
      <span className="w-[88px] shrink-0 font-mono text-11 text-text-quiet">
        {count === 1
          ? `${weekdayShort(from)} ${ddmm(from)}`
          : `${from.slice(8, 10)}–${ddmm(addDays(from, count - 1))}`}
      </span>
      <span className="font-mono text-11 text-text-quiet">
        {count === 1 ? '—' : `— ${count} ${plural(count, 'пустой день', 'пустых дня', 'пустых дней')} —`}
      </span>
    </button>
  )
}

/**
 * Мини-плитка полосы: тот же цвет, что у большой (срочность или серые
 * состояния — честная запись прошлого), пропорции TILE в масштабе MINI.
 */
function MiniTile({ task, today }: { task: TaskRow; today: DateStr }) {
  const state = taskState(task, today)
  const urgency = effectiveUrgency(task, today)
  const { w, h } = TILE[task.importance]
  return (
    <span
      className="block shrink-0"
      style={{
        width: w * MINI + (w - 1) * MINI_GAP,
        height: h * MINI + (h - 1) * MINI_GAP,
        borderRadius: 1,
        background: tileFill({ state, urgency }),
        boxShadow: state === 'expired' ? 'inset 0 0 0 1px var(--expired-outline)' : undefined,
      }}
    />
  )
}
