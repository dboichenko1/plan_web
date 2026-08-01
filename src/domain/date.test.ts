import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  daysInMonth,
  fromDayNumber,
  isLeapYear,
  isoWeekday,
  toDayNumber,
} from './date'

describe('toDayNumber / fromDayNumber', () => {
  it('эпоха', () => {
    expect(toDayNumber('1970-01-01')).toBe(0)
    expect(fromDayNumber(0)).toBe('1970-01-01')
  })

  it('обратимы на широком диапазоне', () => {
    for (const d of ['1969-12-31', '2000-02-29', '2026-08-01', '2100-03-01', '1900-02-28']) {
      expect(fromDayNumber(toDayNumber(d))).toBe(d)
    }
  })

  it('соседние дни отличаются на единицу через границы месяца и года', () => {
    expect(toDayNumber('2026-03-01') - toDayNumber('2026-02-28')).toBe(1)
    expect(toDayNumber('2027-01-01') - toDayNumber('2026-12-31')).toBe(1)
    expect(toDayNumber('2024-02-29') - toDayNumber('2024-02-28')).toBe(1)
  })
})

describe('daysBetween', () => {
  it('положительно, когда второй аргумент позже', () => {
    expect(daysBetween('2026-08-01', '2026-08-04')).toBe(3)
    expect(daysBetween('2026-08-04', '2026-08-01')).toBe(-3)
    expect(daysBetween('2026-08-01', '2026-08-01')).toBe(0)
  })
})

describe('addDays', () => {
  it('переходит через месяц, год и 29 февраля', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01')
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31')
  })
})

describe('isoWeekday', () => {
  it('понедельник = 1, воскресенье = 7', () => {
    expect(isoWeekday('1970-01-01')).toBe(4) // четверг
    expect(isoWeekday('2026-08-03')).toBe(1)
    expect(isoWeekday('2026-08-02')).toBe(7)
    expect(isoWeekday('2026-08-01')).toBe(6)
  })
})

describe('daysInMonth / isLeapYear', () => {
  it('февраль и високосность', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2025, 2)).toBe(28)
    expect(daysInMonth(2000, 2)).toBe(29) // делится на 400
    expect(daysInMonth(1900, 2)).toBe(28) // делится на 100, но не на 400
    expect(isLeapYear(2400)).toBe(true)
  })

  it('длины остальных месяцев', () => {
    expect(daysInMonth(2026, 1)).toBe(31)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 6)).toBe(30)
    expect(daysInMonth(2026, 9)).toBe(30)
    expect(daysInMonth(2026, 11)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })
})
