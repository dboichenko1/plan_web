// Статистика — обзор (макет 14): выполнено, живучесть дня, слетело,
// матрица важно/срочно, индекс пожара, срок дожития. Все графики — простые
// div-полосы, Recharts здесь не нужен.

import {
  statsLeadTime,
  statsMatrix,
  statsSlipped,
  statsSummary,
  statsSurvival,
  type Period,
  type SurvivalRow,
} from '../../data/stats'
import { addDays, daysBetween } from '../../domain/date'
import type { DateStr } from '../../domain/types'
import { EmptyState } from '../../ui/EmptyState'
import { NO_CATEGORY_COLOR, useCategoryColors, useStat, type PeriodKind } from './StatsScreen'

const MONTHS_NOM = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
] as const

const MONTHS_DAT = [
  'январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню',
  'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю',
] as const

/** «Слетело за август» — период называем по-человечески. */
function slippedTitle(kind: PeriodKind, p: Period): string {
  if (kind === 'day') return 'Слетело за день'
  if (kind === 'week') return 'Слетело за неделю'
  if (kind === 'month') return `Слетело за ${MONTHS_NOM[Number(p.from.slice(5, 7)) - 1] ?? 'месяц'}`
  return 'Слетело за период'
}

/** Подпись сравнения под числом «Выполнено»: «к июлю», «к прошлой неделе». */
function prevCaption(kind: PeriodKind, p: Period): string {
  if (kind === 'day') return 'к вчерашнему дню'
  if (kind === 'week') return 'к прошлой неделе'
  if (kind === 'month') {
    const m = Number(p.from.slice(5, 7)) // 1..12; прошлый месяц — соседний индекс
    return `к ${MONTHS_DAT[(m + 10) % 12] ?? 'прошлому месяцу'}`
  }
  return 'к прошлому периоду'
}

export function Overview({
  userId,
  period,
  kind,
}: {
  userId: string
  period: Period
  kind: PeriodKind
}) {
  const summary = useStat(() => statsSummary(period), [period.from, period.to])
  const survival = useStat(() => statsSurvival(period), [period.from, period.to])
  const slipped = useStat(() => statsSlipped(period), [period.from, period.to])
  const matrix = useStat(() => statsMatrix(period), [period.from, period.to])
  const leadTime = useStat(() => statsLeadTime(period), [period.from, period.to])
  const colors = useCategoryColors(userId)

  if (!summary || !survival || !slipped || !matrix || !leadTime) return null

  if (summary.done_count === 0 && summary.prev_done_count === 0 && slipped.length === 0) {
    return (
      <EmptyState title="Пока нечего считать" hint="Выполните первую задачу — цифры появятся" />
    )
  }

  const diff = summary.done_count - summary.prev_done_count
  const slippedTotal = slipped.reduce((s, r) => s + r.slipped_count, 0)
  const slippedMax = slipped.reduce((m, r) => Math.max(m, r.slipped_count), 0)
  const leadMax = leadTime.reduce((m, r) => Math.max(m, r.median_days), 0)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <div className="flex-1 rounded-tile bg-surface p-3">
          <div className="text-11 text-text-quiet">Выполнено</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-tile text-32 font-semibold leading-none text-text">
              {summary.done_count}
            </span>
            <span
              className="font-mono text-11"
              style={{ color: diff >= 0 ? 'var(--u2)' : 'var(--text-muted)' }}
            >
              {diff >= 0 ? `+${diff}` : `−${-diff}`}
            </span>
          </div>
          <div className="mt-1 font-mono text-11 text-text-quiet">{prevCaption(kind, period)}</div>
        </div>

        <SurvivalBlock period={period} rows={survival} />
      </div>

      <div className="rounded-tile bg-surface p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-11 text-text-quiet">{slippedTitle(kind, period)}</span>
          <span className="font-tile text-24 font-semibold text-text">{slippedTotal}</span>
        </div>
        {slipped.length > 0 ? (
          <>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {slipped.map((r) => (
                <BarRow
                  key={r.category_id ?? 'none'}
                  name={r.category_name?.toLowerCase() ?? 'без категории'}
                  frac={slippedMax > 0 ? r.slipped_count / slippedMax : 0}
                  fill={r.category_id ? (colors.get(r.category_id) ?? NO_CATEGORY_COLOR) : NO_CATEGORY_COLOR}
                  value={String(r.slipped_count)}
                />
              ))}
            </div>
            <div className="mt-2 text-11 text-text-quiet">что именно стабильно роняется</div>
          </>
        ) : (
          <div className="mt-2 text-11 text-text-quiet">ничего не слетело — период чистый</div>
        )}
      </div>

      <MatrixBlock matrix={matrix} />

      <div className="rounded-tile bg-surface p-3">
        <div className="text-11 text-text-quiet">Индекс пожара</div>
        <div className="mt-1 font-tile text-32 font-semibold leading-none text-text">
          {summary.fire_index === null ? '—' : `${Math.round(summary.fire_index * 100)}%`}
        </div>
        <div className="mt-1.5 text-11 text-text-quiet">
          столько дел вы делали в последний момент
        </div>
      </div>

      {leadTime.length > 0 && (
        <div className="rounded-tile bg-surface p-3">
          <div className="text-11 text-text-quiet">Срок дожития</div>
          <div className="mt-0.5 mb-2 text-11 text-text-quiet">
            медиана дней от создания до выполнения
          </div>
          <div className="flex flex-col gap-1.5">
            {leadTime.map((r) => (
              <BarRow
                key={r.category_id ?? 'none'}
                name={r.category_name?.toLowerCase() ?? 'без категории'}
                frac={leadMax > 0 ? r.median_days / leadMax : 0}
                fill="var(--text-muted)"
                value={fmtDays(r.median_days)}
                valueWidth={40}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** «3,5 д»: до десяти дней — с десятой, дальше дробь не читается. */
function fmtDays(days: number): string {
  const v = days < 10 ? Math.round(days * 10) / 10 : Math.round(days)
  return `${String(v).replace('.', ',')} д`
}

function BarRow({
  name,
  frac,
  fill,
  value,
  valueWidth = 20,
}: {
  name: string
  frac: number
  fill: string
  value: string
  valueWidth?: number
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[62px] shrink-0 truncate text-11 text-text-muted">{name}</span>
      <span className="block h-2.5 flex-1 overflow-hidden rounded-[1px] bg-surface2">
        <span
          className="block h-2.5"
          style={{ width: `${Math.round(frac * 100)}%`, background: fill }}
        />
      </span>
      <span
        className="shrink-0 text-right font-mono text-11 text-text"
        style={{ width: valueWidth }}
      >
        {value}
      </span>
    </div>
  )
}

/** Сколько мини-столбиков помещается в узкий блок: длинный период режем с хвоста. */
const SURVIVAL_BARS_MAX = 16

function SurvivalBlock({ period, rows }: { period: Period; rows: SurvivalRow[] }) {
  const byDay = new Map(rows.map((r) => [r.scheduled_on, r.survival]))
  // Крупный процент — по всему периоду; столбики — только последние дни.
  const avg = rows.length > 0 ? rows.reduce((s, r) => s + r.survival, 0) / rows.length : null
  const dayCount = Math.min(daysBetween(period.from, period.to) + 1, SURVIVAL_BARS_MAX)
  const first = addDays(period.to, 1 - dayCount)
  const days: DateStr[] = Array.from({ length: dayCount }, (_, i) => addDays(first, i))

  return (
    <div className="flex-1 rounded-tile bg-surface p-3">
      <div className="text-11 text-text-quiet">Живучесть дня</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="font-tile text-32 font-semibold leading-none text-text">
          {avg === null ? '—' : `${Math.round(avg * 100)}%`}
        </span>
        <span className="flex h-7 max-w-[96px] flex-1 items-end gap-[2px]">
          {days.map((d) => {
            const v = byDay.get(d)
            return (
              <span
                key={d}
                className="relative block h-full min-w-[2px] max-w-[8px] flex-1 overflow-hidden rounded-[1px] bg-surface2"
              >
                {v !== undefined && (
                  <span
                    className="absolute inset-x-0 bottom-0 block"
                    style={{ height: `${Math.max(4, Math.round(v * 100))}%`, background: 'var(--accent)' }}
                  />
                )}
              </span>
            )
          })}
        </span>
      </div>
      <div className="mt-1 font-mono text-11 text-text-quiet">из запланированного</div>
    </div>
  )
}

const QUADRANTS: { label: string; urgent: boolean; important: boolean }[] = [
  { label: 'срочно · важно', urgent: true, important: true },
  { label: 'не срочно · важно', urgent: false, important: true },
  { label: 'срочно · мелочь', urgent: true, important: false },
  { label: 'не срочно · мелочь', urgent: false, important: false },
]

function MatrixBlock({
  matrix,
}: {
  matrix: { urgent: boolean; important: boolean; done_count: number; share: number }[]
}) {
  return (
    <div className="rounded-tile bg-surface p-3">
      <div className="mb-2 text-11 text-text-quiet">Матрица</div>
      <div className="grid grid-cols-2 gap-[2px]">
        {QUADRANTS.map((q) => {
          const cell = matrix.find((m) => m.urgent === q.urgent && m.important === q.important)
          return (
            <div
              key={q.label}
              className="flex h-[66px] flex-col justify-between rounded-tile bg-surface2 p-[9px]"
            >
              <span className="text-11 text-text-quiet">{q.label}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-tile text-24 font-semibold leading-none text-text">
                  {cell?.done_count ?? 0}
                </span>
                <span className="font-mono text-11 text-text-quiet">
                  {cell ? `${Math.round(cell.share * 100)}%` : ''}
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
