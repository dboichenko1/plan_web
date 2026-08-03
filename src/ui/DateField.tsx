// Свои поля даты и времени: единый вид ДД.ММ.ГГГГ и ЧЧ:ММ (24 часа) во всех
// темах и локалях. Нативные <input type="date"/"time"> рисуют календарь и
// формат по локали браузера (у английской — MM/DD/YYYY и 12h AM/PM) и на маке
// вылезают за край шторки — поэтому пикеры свои, поповер внутри контейнера.

import { useEffect, useRef, useState } from 'react'
import { addDays, daysInMonth, isoWeekday } from '../domain/date'
import { IconChevronLeft, IconChevronRight } from './icons'

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function dots(value: string): string {
  const [y, m, d] = value.split('-')
  return d && m && y ? `${d}.${m}.${y}` : value
}

/** Закрытие поповера по клику вне. */
function useOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [onClose])
  return ref
}

export function DateField({
  value,
  onChange,
  min,
  placeholder = 'дата',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  min?: string
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useOutside(() => setOpen(false))
  // Месяц в поповере: от выбранной даты, иначе от min/сегодня.
  const base = value || min || todayLocal()
  const [view, setView] = useState(base.slice(0, 7))

  const openPicker = () => {
    setView((value || min || todayLocal()).slice(0, 7))
    setOpen((v) => !v)
  }

  const year = Number(view.slice(0, 4))
  const month = Number(view.slice(5, 7))
  const first = `${view}-01`
  const leading = isoWeekday(first) - 1
  const total = daysInMonth(year, month)
  const cells: (string | null)[] = Array.from({ length: 42 }, (_, i) => {
    const n = i - leading
    return n >= 0 && n < total ? addDays(first, n) : null
  })
  const shiftMonth = (delta: number) => {
    const t = year * 12 + (month - 1) + delta
    setView(`${String(Math.floor(t / 12)).padStart(4, '0')}-${String((t % 12) + 1).padStart(2, '0')}`)
  }

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={openPicker}
        className={`inline-flex items-center ${value ? 'font-mono' : 'text-text-quiet'} ${className}`}
      >
        {value ? dots(value) : placeholder}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-[248px] rounded-tile border border-line bg-surface p-2 shadow-lg"
          style={{ boxShadow: '0 6px 24px var(--scrim)' }}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} className="p-1 text-text-muted">
              <IconChevronLeft size={14} />
            </button>
            <span className="text-13 font-medium text-text">{MONTHS[month - 1]} {year}</span>
            <button type="button" onClick={() => shiftMonth(1)} className="p-1 text-text-muted">
              <IconChevronRight size={14} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-center font-mono text-[10px] text-text-quiet">{w}</span>
            ))}
            {cells.map((d, i) =>
              d === null ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  disabled={min ? d < min : false}
                  onClick={() => {
                    onChange(d)
                    setOpen(false)
                  }}
                  className="flex h-7 items-center justify-center rounded-tile font-mono text-13 disabled:opacity-30"
                  style={
                    d === value
                      ? { background: 'var(--text)', color: 'var(--bg)' }
                      : { color: 'var(--text)' }
                  }
                >
                  {Number(d.slice(8, 10))}
                </button>
              ),
            )}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
              className="mt-1.5 w-full rounded-tile bg-surface2 py-1 text-11 text-text-muted"
            >
              очистить
            </button>
          )}
        </div>
      )}
    </span>
  )
}

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function TimeField({
  value,
  onChange,
  placeholder = 'время',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useOutside(() => setOpen(false))
  const [h, m] = value ? value.split(':') : ['', '']

  const set = (hh: string, mm: string) => onChange(`${hh}:${mm}`)

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center ${value ? 'font-mono' : 'text-text-quiet'} ${className}`}
      >
        {value || placeholder}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 flex h-[180px] gap-1 rounded-tile border border-line bg-surface p-1.5"
          style={{ boxShadow: '0 6px 24px var(--scrim)' }}
        >
          <div className="w-12 overflow-y-auto">
            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((hh) => (
              <button
                key={hh}
                type="button"
                onClick={() => set(hh, m || '00')}
                className="flex w-full items-center justify-center rounded-tile py-1 font-mono text-13"
                style={hh === h ? { background: 'var(--text)', color: 'var(--bg)' } : { color: 'var(--text)' }}
              >
                {hh}
              </button>
            ))}
          </div>
          <div className="w-12 overflow-y-auto">
            {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map((mm) => (
              <button
                key={mm}
                type="button"
                onClick={() => set(h || '09', mm)}
                className="flex w-full items-center justify-center rounded-tile py-1 font-mono text-13"
                style={mm === m ? { background: 'var(--text)', color: 'var(--bg)' } : { color: 'var(--text)' }}
              >
                {mm}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  )
}
