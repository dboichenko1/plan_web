// Статистика — ритм (макет 15): тепловая карта «день недели × четырёхчасовой
// интервал», два вывода текстом и та же карта по одной категории. Шкала карты —
// rgba(120,160,220, a), единственное разрешённое rgba (HANDOFF §2); пустая
// ячейка — var(--surface2).

import { useState } from 'react'
import { db } from '../../data/db'
import { useLive } from '../../data/hooks'
import { statsRhythm, type Period, type RhythmCell } from '../../data/stats'
import { WEEKDAYS_SHORT } from '../../ui/format'
import { useStat } from './StatsScreen'

const SLOT_LABELS = ['0–4', '4–8', '8–12', '12–16', '16–20', '20–24'] as const
const SLOT_PHRASES = ['с 0 до 4', 'с 4 до 8', 'с 8 до 12', 'с 12 до 16', 'с 16 до 20', 'с 20 до 24'] as const
const DAY_NAMES = [
  'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье',
] as const

/** Интенсивность ячейки: a = 0.08 + 0.87·value/max (формула из HANDOFF). */
function cellColor(value: number, max: number): string {
  if (value === 0 || max === 0) return 'var(--surface2)'
  return `rgba(120,160,220,${(0.08 + 0.87 * (value / max)).toFixed(3)})`
}

export function Rhythm({ userId, period }: { userId: string; period: Period }) {
  const cells = useStat(() => statsRhythm(period), [period.from, period.to])

  const categories = useLive(() => db.categories.orderBy('sort_order').toArray(), [userId])
  const cats = (categories ?? []).filter((c) => c.user_id === userId && !c.archived_at)
  const [pickedCat, setPickedCat] = useState<string | null>(null)
  const catId = pickedCat ?? cats[0]?.id
  const catCells = useStat(
    () => (catId === undefined ? Promise.resolve([]) : statsRhythm(period, catId)),
    [period.from, period.to, catId],
  )

  if (!cells) return null

  // Итоги по дням недели и по интервалам — для двух выводов под картой.
  const byDow = Array<number>(7).fill(0)
  const bySlot = Array<number>(6).fill(0)
  let total = 0
  for (const c of cells) {
    if (c.dow >= 1 && c.dow <= 7) byDow[c.dow - 1] = (byDow[c.dow - 1] ?? 0) + c.done_count
    if (c.slot >= 0 && c.slot <= 5) bySlot[c.slot] = (bySlot[c.slot] ?? 0) + c.done_count
    total += c.done_count
  }
  const bestDow = byDow.indexOf(Math.max(...byDow))
  const bestSlot = bySlot.indexOf(Math.max(...bySlot))

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-tile bg-surface p-3">
        <div className="mb-2.5 text-11 text-text-quiet">Когда вы закрываете задачи</div>
        <HeatMap cells={cells} cellHeight={26} />
        <Legend />
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-1 px-0.5">
          <div className="text-15 text-text">
            Самый продуктивный день — {DAY_NAMES[bestDow] ?? ''}.
          </div>
          <div className="text-15 text-text">
            Самое продуктивное время — {SLOT_PHRASES[bestSlot] ?? ''}.
          </div>
        </div>
      )}

      {cats.length > 0 && (
        <div className="rounded-tile bg-surface p-3">
          <div className="mb-2.5 text-11 text-text-quiet">Только категория</div>
          <div className="mb-2.5 flex gap-1 overflow-x-auto">
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setPickedCat(c.id)}
                className={`flex h-[30px] shrink-0 items-center rounded-tile px-3 text-13 ${
                  c.id === catId ? 'bg-text font-medium text-bg' : 'bg-surface2 text-text'
                }`}
              >
                {c.name.toLowerCase()}
              </button>
            ))}
          </div>
          <HeatMap cells={catCells ?? []} cellHeight={18} />
        </div>
      )}
    </div>
  )
}

function HeatMap({ cells, cellHeight }: { cells: RhythmCell[]; cellHeight: number }) {
  // Матрица 6 строк (интервалы) × 7 колонок (пн..вс).
  const grid: number[][] = Array.from({ length: 6 }, () => Array<number>(7).fill(0))
  let max = 0
  for (const c of cells) {
    const row = grid[c.slot]
    if (!row || c.dow < 1 || c.dow > 7) continue
    row[c.dow - 1] = c.done_count
    max = Math.max(max, c.done_count)
  }

  return (
    <div>
      <div className="mb-1 flex gap-[2px] pl-[42px]">
        {WEEKDAYS_SHORT.map((wd) => (
          <span key={wd} className="flex-1 text-center font-mono text-11 text-text-quiet">
            {wd}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-[2px]">
        {grid.map((row, slot) => (
          <div key={slot} className="flex items-center gap-[2px]">
            <span className="w-[40px] shrink-0 font-mono text-11 text-text-quiet">
              {SLOT_LABELS[slot]}
            </span>
            {row.map((value, dow) => (
              <span
                key={dow}
                className="flex-1 rounded-[1px]"
                style={{ height: cellHeight, background: cellColor(value, max) }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="mt-2.5 flex items-center gap-1.5">
      <span className="font-mono text-11 text-text-quiet">реже</span>
      <span className="flex gap-[2px]">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span
            key={f}
            className="h-2 w-3.5 rounded-[1px]"
            style={{ background: `rgba(120,160,220,${(0.08 + 0.87 * f).toFixed(3)})` }}
          />
        ))}
      </span>
      <span className="font-mono text-11 text-text-quiet">чаще</span>
    </div>
  )
}
