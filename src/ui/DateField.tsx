// Дата в русском формате ДД.ММ.ГГГГ. Родной <input type="date"> показывает
// формат локали браузера (у английской — MM/DD/YYYY), поэтому текст рисуем
// сами, а невидимый нативный инпут лежит сверху и открывает календарь по тапу —
// это работает и на iOS, где showPicker() ненадёжен.

import type { ChangeEvent } from 'react'

function dots(value: string): string {
  const [y, m, d] = value.split('-')
  return d && m && y ? `${d}.${m}.${y}` : value
}

export function DateField({
  value,
  onChange,
  min,
  max,
  placeholder = 'дата',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
  className?: string
}) {
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <span className={value ? 'font-mono' : 'text-text-quiet'}>
        {value ? dots(value) : placeholder}
      </span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        aria-label={placeholder}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  )
}
