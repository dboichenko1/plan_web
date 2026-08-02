// Статистика: контейнер с селектором периода и под-вкладками
// обзор / ритм / категории. Контент под шапкой скроллится.

import { useEffect, useState } from 'react'
import { db } from '../../data/db'
import { useLive } from '../../data/hooks'
import { periodFor, type Period } from '../../data/stats'
import { addDays } from '../../domain/date'
import type { DateStr } from '../../domain/types'
import { IconSettings } from '../../ui/icons'
import { DateField as RuDateField } from '../../ui/DateField'
import { Overview } from './Overview'
import { Rhythm } from './Rhythm'
import { Categories } from './Categories'

export type PeriodKind = 'day' | 'week' | 'month' | 'range'

type SubTab = 'overview' | 'rhythm' | 'categories'

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: 'day', label: 'день' },
  { id: 'week', label: 'неделя' },
  { id: 'month', label: 'месяц' },
  { id: 'range', label: 'период' },
]

const TABS: { id: SubTab; label: string }[] = [
  { id: 'overview', label: 'обзор' },
  { id: 'rhythm', label: 'ритм' },
  { id: 'categories', label: 'категории' },
]

export function StatsScreen({
  userId,
  today,
  onOpenSettings,
}: {
  userId: string
  today: string
  onOpenSettings?: () => void
}) {
  const [kind, setKind] = useState<PeriodKind>('month')
  const [tab, setTab] = useState<SubTab>('overview')
  // Произвольный период: по умолчанию последние 30 дней.
  const [from, setFrom] = useState<DateStr>(() => addDays(today, -29))
  const [to, setTo] = useState<DateStr>(today)

  // «От» позже «до» не ломает выборку — концы просто упорядочиваем.
  const period: Period =
    kind === 'range'
      ? from <= to
        ? { from, to }
        : { from: to, to: from }
      : periodFor(kind, today)

  return (
    <div className="flex h-full flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="shrink-0 px-3 pt-1.5">
        <div className="flex items-start justify-between">
          <h1 className="font-tile text-24 font-semibold leading-[1.1] text-text">Статистика</h1>
          {onOpenSettings && (
            <button
              type="button"
              aria-label="Настройки"
              onClick={onOpenSettings}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-tile bg-surface text-text-muted"
            >
              <IconSettings size={17} />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={`flex h-[30px] items-center rounded-tile px-3 text-13 ${
                kind === k.id ? 'bg-text font-medium text-bg' : 'bg-surface2 text-text'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {kind === 'range' && (
          <div className="mt-2 flex gap-1">
            <DateField label="от" value={from} onChange={setFrom} />
            <DateField label="до" value={to} onChange={setTo} />
          </div>
        )}

        <div className="mt-2.5 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`h-[34px] flex-1 rounded-tile text-13 ${
                tab === t.id ? 'bg-surface2 font-medium text-text' : 'bg-surface text-text-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2.5">
        {tab === 'overview' && <Overview userId={userId} period={period} kind={kind} />}
        {tab === 'rhythm' && <Rhythm userId={userId} period={period} />}
        {tab === 'categories' && <Categories userId={userId} period={period} />}
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

// --- Общее для под-экранов -------------------------------------------------

/**
 * Однократная загрузка при смене периода. liveQuery не годится:
 * путь через Supabase — RPC, а не запрос к Dexie.
 */
export function useStat<T>(load: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const [value, setValue] = useState<T>()
  useEffect(() => {
    let alive = true
    load()
      .then((v) => {
        if (alive) setValue(v)
      })
      .catch((e: unknown) => {
        console.error('статистика не загрузилась', e)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return value
}

/** Цвет полос: var(--cat-N) по порядку sort_order (палитра только для графиков). */
export function useCategoryColors(userId: string): Map<string, string> {
  const categories = useLive(() => db.categories.orderBy('sort_order').toArray(), [userId])
  const map = new Map<string, string>()
  for (const c of (categories ?? []).filter((c) => c.user_id === userId)) {
    map.set(c.id, `var(--cat-${(map.size % 7) + 1})`)
  }
  return map
}

/** Полоса задач без категории — нейтральная, чтобы не спорить с cat-цветами. */
export const NO_CATEGORY_COLOR = 'var(--text-quiet)'
