// Календарная арифметика над строками 'YYYY-MM-DD' без объекта Date:
// у строки нет часового пояса, и задача с первого числа не уедет на тридцать первое.
// Алгоритмы days_from_civil / civil_from_days — Говард Хиннант.

import type { DateStr } from './types'

/** Дней с 1970-01-01 (может быть отрицательным). */
export function toDayNumber(d: DateStr): number {
  const y = Number(d.slice(0, 4))
  const m = Number(d.slice(5, 7))
  const day = Number(d.slice(8, 10))
  const yy = m <= 2 ? y - 1 : y
  const era = Math.floor(yy / 400)
  const yoe = yy - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

export function fromDayNumber(n: number): DateStr {
  const z = n + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  const yy = m <= 2 ? y + 1 : y
  return `${String(yy).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** b − a в днях: положительно, когда b позже a. */
export function daysBetween(a: DateStr, b: DateStr): number {
  return toDayNumber(b) - toDayNumber(a)
}

export function addDays(d: DateStr, n: number): DateStr {
  return fromDayNumber(toDayNumber(d) + n)
}

/** День недели ISO: 1 — понедельник … 7 — воскресенье. */
export function isoWeekday(d: DateStr): number {
  const n = toDayNumber(d)
  return ((((n + 3) % 7) + 7) % 7) + 1
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}
