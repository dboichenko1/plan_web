// Вложенная шторка правила повторения (макет 08). Черновик собирается при
// открытии из value; наружу правило уходит только по «Готово».

import { useEffect, useState, type ReactNode } from 'react'
import type { Rule } from '../domain/recurrence'
import { isoWeekday } from '../domain/date'
import type { DateStr } from '../domain/types'
import { describeRule } from '../data/templates'
import { Sheet } from '../ui/Sheet'
import { WEEKDAYS_SHORT, plural } from '../ui/format'

type Freq = Rule['freq']
type EndsMode = Rule['ends']['mode']

const FREQ_ORDER: readonly Freq[] = ['daily', 'weekly', 'monthly', 'yearly']
const FREQ_LABEL: Record<Freq, string> = {
  daily: 'день',
  weekly: 'неделя',
  monthly: 'месяц',
  yearly: 'год',
}

/** «2 недели» → подпись рядом со степпером «Каждые». */
function stepUnit(freq: Freq, n: number): string {
  switch (freq) {
    case 'daily':
      return plural(n, 'день', 'дня', 'дней')
    case 'weekly':
      return plural(n, 'неделю', 'недели', 'недель')
    case 'monthly':
      return plural(n, 'месяц', 'месяца', 'месяцев')
    case 'yearly':
      return plural(n, 'год', 'года', 'лет')
  }
}

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number
  min: number
  max: number
  onChange: (next: number) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`${label}: меньше`}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-tile bg-surface2 text-text"
      >
        −
      </button>
      <span className="w-[52px] text-center font-mono text-15 text-text">{value}</span>
      <button
        type="button"
        aria-label={`${label}: больше`}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-9 w-9 items-center justify-center rounded-tile bg-surface2 text-text"
      >
        +
      </button>
    </div>
  )
}

export function RepeatSheet({
  open,
  onClose,
  value,
  onChange,
  startsOn,
}: {
  open: boolean
  onClose: () => void
  value: Rule | null
  onChange: (rule: Rule | null) => void
  startsOn: DateStr
}) {
  const [freq, setFreq] = useState<Freq>('weekly')
  const [step, setStep] = useState(1)
  const [weekdays, setWeekdays] = useState<number[]>([1])
  const [monthday, setMonthday] = useState(1)
  const [endsMode, setEndsMode] = useState<EndsMode>('never')
  const [endsOn, setEndsOn] = useState('')
  const [endsAfter, setEndsAfter] = useState(10)

  // Черновик собирается заново при каждом открытии; закрытие без «Готово» ничего не меняет.
  useEffect(() => {
    if (!open) return
    setFreq(value?.freq ?? 'weekly')
    setStep(value?.step ?? 1)
    setWeekdays(
      value?.byweekday && value.byweekday.length > 0
        ? [...value.byweekday].sort((a, b) => a - b)
        : [isoWeekday(startsOn)],
    )
    setMonthday(value?.bymonthday ?? Number(startsOn.slice(8, 10)))
    setEndsMode(value?.ends.mode ?? 'never')
    setEndsOn(value?.ends.mode === 'on' ? value.ends.on : '')
    setEndsAfter(value?.ends.mode === 'after' ? value.ends.after : 10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggleWeekday(d: number) {
    setWeekdays((prev) =>
      prev.includes(d)
        ? prev.length > 1 // последний день снять нельзя: у недельного повтора он обязан быть
          ? prev.filter((x) => x !== d)
          : prev
        : [...prev, d].sort((a, b) => a - b),
    )
  }

  // «До даты» без даты вырождается в «никогда» — правило остаётся валидным.
  const draft: Rule = {
    freq,
    step,
    ...(freq === 'weekly' ? { byweekday: weekdays } : {}),
    ...(freq === 'monthly' ? { bymonthday: monthday } : {}),
    starts_on: startsOn,
    ends:
      endsMode === 'on' && endsOn
        ? { mode: 'on', on: endsOn }
        : endsMode === 'after'
          ? { mode: 'after', after: endsAfter }
          : { mode: 'never' },
  }

  const preview = describeRule(draft)

  return (
    <Sheet open={open} onClose={onClose} height="76%">
      <div className="flex min-h-0 flex-1 flex-col bg-surface">
        <div className="flex shrink-0 justify-center pb-1.5 pt-2">
          <div className="h-1 w-9 rounded-tile bg-line" />
        </div>
        <div className="shrink-0 px-4">
          <div className="font-tile text-24 font-semibold text-text">Повтор</div>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4">
          <div className="flex shrink-0 flex-col gap-1.5">
            <span className="text-11 text-text-muted">Частота</span>
            <div className="grid grid-cols-4 gap-1">
              {FREQ_ORDER.map((f) => {
                const on = f === freq
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFreq(f)}
                    className="h-9 rounded-tile text-13"
                    style={
                      on
                        ? { background: 'var(--text)', color: 'var(--bg)', fontWeight: 500 }
                        : { background: 'var(--surface2)', color: 'var(--text)' }
                    }
                  >
                    {FREQ_LABEL[f]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between">
            <span className="text-15 text-text">Каждые</span>
            <div className="flex items-center gap-1">
              <Stepper value={step} min={1} max={99} onChange={setStep} label="Каждые" />
              <span className="ml-1.5 text-13 text-text-muted">{stepUnit(freq, step)}</span>
            </div>
          </div>

          {freq === 'weekly' && (
            <div className="flex shrink-0 flex-col gap-1.5">
              <span className="text-11 text-text-muted">Дни недели</span>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS_SHORT.map((name, i) => {
                  const d = i + 1
                  const on = weekdays.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleWeekday(d)}
                      className="h-10 rounded-tile font-mono text-13"
                      style={
                        on
                          ? { background: 'var(--text)', color: 'var(--bg)', fontWeight: 500 }
                          : { background: 'var(--surface2)', color: 'var(--text-muted)' }
                      }
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {freq === 'monthly' && (
            <div className="flex shrink-0 items-center justify-between">
              <span className="text-15 text-text">Число месяца</span>
              <Stepper value={monthday} min={1} max={31} onChange={setMonthday} label="Число месяца" />
            </div>
          )}

          <div className="flex shrink-0 flex-col gap-1.5">
            <span className="text-11 text-text-muted">Окончание</span>
            <div className="flex flex-col">
              <EndsRow label="Никогда" on={endsMode === 'never'} onSelect={() => setEndsMode('never')} />
              <EndsRow label="До даты" on={endsMode === 'on'} onSelect={() => setEndsMode('on')}>
                {endsMode === 'on' && (
                  <input
                    type="date"
                    aria-label="Дата окончания"
                    value={endsOn}
                    min={startsOn}
                    onChange={(e) => setEndsOn(e.target.value)}
                    className="h-[30px] rounded-tile border-0 bg-surface2 px-2.5 font-mono text-13 text-text outline-none"
                  />
                )}
              </EndsRow>
              <EndsRow
                label="После N раз"
                last
                on={endsMode === 'after'}
                onSelect={() => setEndsMode('after')}
              >
                {endsMode === 'after' && (
                  <Stepper value={endsAfter} min={1} max={99} onChange={setEndsAfter} label="Повторений" />
                )}
              </EndsRow>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 px-4 pb-2.5 pt-2">
          <div className="font-mono text-11 text-text-quiet">{preview}</div>
          <button
            type="button"
            onClick={() => {
              onChange(draft)
              onClose()
            }}
            className="h-12 w-full rounded-tile text-15 font-medium"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
          >
            Готово
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(null)
              onClose()
            }}
            className="h-11 w-full rounded-tile bg-surface2 text-15 font-medium text-text"
          >
            Не повторять
          </button>
        </div>
      </div>
    </Sheet>
  )
}

/** Строка выбора окончания: подпись, опциональный ввод и квадрат-переключатель. */
function EndsRow({
  label,
  on,
  onSelect,
  last,
  children,
}: {
  label: string
  on: boolean
  onSelect: () => void
  last?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className="flex h-[46px] items-center justify-between"
      style={last ? undefined : { borderBottom: '1px solid var(--line)' }}
    >
      <button type="button" onClick={onSelect} className="flex-1 text-left text-15 text-text">
        {label}
      </button>
      <span className="flex items-center gap-2">
        {children}
        <button
          type="button"
          aria-label={label}
          onClick={onSelect}
          className="h-3.5 w-3.5 rounded-tile"
          style={on ? { background: 'var(--accent)' } : { border: '1px solid var(--line)' }}
        />
      </span>
    </div>
  )
}
