// Статистика — категории и теги (макет 16): полосы по категориям, столбцы
// по месяцам с сегментами-категориями, топ-10 тегов. Всё простыми div-ами.

import {
  statsByCategory,
  statsByMonth,
  statsTopTags,
  type MonthCategoryCount,
  type Period,
} from '../../data/stats'
import { EmptyState } from '../../ui/EmptyState'
import { NO_CATEGORY_COLOR, useCategoryColors, useStat } from './StatsScreen'

const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
] as const

/** Высота области столбцов по месяцам, px — как на макете. */
const CHART_H = 120

export function Categories({ userId, period }: { userId: string; period: Period }) {
  const byCat = useStat(() => statsByCategory(period), [period.from, period.to])
  const byMonth = useStat(() => statsByMonth(period), [period.from, period.to])
  const topTags = useStat(() => statsTopTags(period, 10), [period.from, period.to])
  const colors = useCategoryColors(userId)

  if (!byCat || !byMonth || !topTags) return null

  if (byCat.length === 0 && topTags.length === 0) {
    return (
      <EmptyState title="Пока нечего считать" hint="Выполните первую задачу — цифры появятся" />
    )
  }

  const total = byCat.reduce((s, r) => s + r.done_count, 0)
  const catMax = byCat.reduce((m, r) => Math.max(m, r.done_count), 0)
  const tagMax = topTags.reduce((m, r) => Math.max(m, r.done_count), 0)
  const fillOf = (id: string | null) => (id ? (colors.get(id) ?? NO_CATEGORY_COLOR) : NO_CATEGORY_COLOR)

  return (
    <div className="flex flex-col gap-1">
      {byCat.length > 0 && (
        <div className="rounded-tile bg-surface p-3">
          <div className="mb-2.5 text-11 text-text-quiet">По категориям</div>
          <div className="flex flex-col gap-2">
            {byCat.map((r) => (
              <div key={r.category_id ?? 'none'} className="flex items-center gap-2.5">
                <span className="w-[62px] shrink-0 truncate text-11 text-text-muted">
                  {r.category_name?.toLowerCase() ?? 'без категории'}
                </span>
                <span className="block h-3 flex-1 overflow-hidden rounded-[1px] bg-surface2">
                  <span
                    className="block h-3"
                    style={{
                      width: `${catMax > 0 ? Math.round((r.done_count / catMax) * 100) : 0}%`,
                      background: fillOf(r.category_id),
                    }}
                  />
                </span>
                <span className="w-[52px] shrink-0 text-right font-mono text-11 text-text">
                  {r.done_count}
                  {total > 0 && ` · ${Math.round((r.done_count / total) * 100)}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <MonthsBlock rows={byMonth} fillOf={fillOf} />

      {topTags.length > 0 && (
        <div className="rounded-tile bg-surface p-3">
          <div className="mb-2.5 text-11 text-text-quiet">Топ тегов</div>
          <div className="flex flex-col gap-1.5">
            {topTags.map((t) => (
              <div key={t.tag_id} className="flex items-center gap-2.5">
                <span className="w-[76px] shrink-0 truncate font-mono text-11 text-text-muted">
                  {t.tag_name}
                </span>
                <span className="block h-2.5 flex-1 overflow-hidden rounded-[1px] bg-surface2">
                  <span
                    className="block h-2.5 bg-accent"
                    style={{ width: `${tagMax > 0 ? Math.round((t.done_count / tagMax) * 100) : 0}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right font-mono text-11 text-text">
                  {t.done_count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

type MonthColumn = {
  month: string
  total: number
  segments: { category_id: string | null; count: number }[]
}

function MonthsBlock({
  rows,
  fillOf,
}: {
  rows: MonthCategoryCount[]
  fillOf: (id: string | null) => string
}) {
  // Группировка «месяц → сегменты»: строки уже отсортированы по месяцу,
  // внутри месяца — по убыванию счётчика (порядок из RPC).
  const columns: MonthColumn[] = []
  for (const r of rows) {
    let col = columns[columns.length - 1]
    if (!col || col.month !== r.month) {
      col = { month: r.month, total: 0, segments: [] }
      columns.push(col)
    }
    col.total += r.done_count
    col.segments.push({ category_id: r.category_id, count: r.done_count })
  }
  if (columns.length === 0) return null

  const maxTotal = columns.reduce((m, c) => Math.max(m, c.total), 0)

  return (
    <div className="rounded-tile bg-surface p-3">
      <div className="mb-3 text-11 text-text-quiet">По месяцам · сегменты — категории</div>
      <div className="flex items-end gap-1.5" style={{ height: CHART_H + 20 }}>
        {columns.map((c) => (
          <span key={c.month} className="flex flex-1 flex-col items-center gap-1.5">
            {/* column-reverse: первый (самый крупный) сегмент лежит внизу */}
            <span className="flex w-full flex-col-reverse gap-px">
              {c.segments.map((s, i) => (
                <span
                  key={s.category_id ?? `none-${i}`}
                  className="block w-full"
                  style={{
                    height: Math.max(2, Math.round((s.count / maxTotal) * CHART_H)),
                    background: fillOf(s.category_id),
                  }}
                />
              ))}
            </span>
            <span className="font-mono text-11 text-text-quiet">{monthShort(c.month)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** 'YYYY-MM' → «авг»; чужой год уточняем: «дек 25». */
function monthShort(month: string): string {
  const name = MONTHS_SHORT[Number(month.slice(5, 7)) - 1] ?? month
  const year = new Date().getFullYear()
  return Number(month.slice(0, 4)) === year ? name : `${name} ${month.slice(2, 4)}`
}
