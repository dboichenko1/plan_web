// Разворачивание правила повторения в конкретные даты.
// Свой формат вместо RFC 5545; вся арифметика — на номерах дней из date.ts.

import type { DateStr } from './types'
import { daysInMonth, fromDayNumber, isoWeekday, toDayNumber } from './date'

export type Rule = {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  /** Каждые N, 1..99. */
  step: number
  /** Дни недели 1..7 (ISO, пн = 1); только для weekly. */
  byweekday?: number[]
  /** Число месяца 1..31; только для monthly. */
  bymonthday?: number
  starts_on: DateStr
  ends: { mode: 'never' } | { mode: 'on'; on: DateStr } | { mode: 'after'; after: number }
}

/** Даты повторений внутри окна [from, to] включительно, по возрастанию, без дублей. */
export function expand(rule: Rule, from: DateStr, to: DateStr): DateStr[] {
  if (from > to) return []
  const ends = rule.ends
  if (ends.mode === 'after' && ends.after <= 0) return []
  const upper = ends.mode === 'on' && ends.on < to ? ends.on : to
  const lower = rule.starts_on > from ? rule.starts_on : from
  if (lower > upper) return []
  // Для 'after' счётчик повторений ведётся от starts_on, поэтому прыгать к окну
  // без счёта нельзя; конечный limit это запрещает, Infinity — разрешает.
  const limit = ends.mode === 'after' ? ends.after : Infinity
  switch (rule.freq) {
    case 'daily':
      return expandDaily(rule.starts_on, rule.step, lower, upper, limit)
    case 'weekly':
      return expandWeekly(rule.starts_on, rule.step, weeklyDays(rule), lower, upper, limit)
    case 'monthly':
      return expandMonthly(rule.starts_on, rule.step, rule.bymonthday ?? Number(rule.starts_on.slice(8, 10)), lower, upper, limit)
    case 'yearly':
      return expandYearly(rule.starts_on, rule.step, lower, upper, limit)
  }
}

function weeklyDays(rule: Rule): number[] {
  const raw = rule.byweekday
  if (raw === undefined || raw.length === 0) return [isoWeekday(rule.starts_on)]
  return Array.from(new Set(raw)).sort((a, b) => a - b)
}

function expandDaily(startsOn: DateStr, step: number, lower: DateStr, upper: DateStr, limit: number): DateStr[] {
  const startN = toDayNumber(startsOn)
  const upperN = toDayNumber(upper)
  // lower >= starts_on, поэтому индекс первого повторения в окне неотрицателен;
  // он же — номер повторения от начала серии, что даёт границу для 'after'.
  let k = Math.ceil((toDayNumber(lower) - startN) / step)
  const out: DateStr[] = []
  for (; k < limit; k++) {
    const n = startN + k * step
    if (n > upperN) break
    out.push(fromDayNumber(n))
  }
  return out
}

function expandWeekly(startsOn: DateStr, step: number, weekdays: number[], lower: DateStr, upper: DateStr, limit: number): DateStr[] {
  const startN = toDayNumber(startsOn)
  const lowerN = toDayNumber(lower)
  const upperN = toDayNumber(upper)
  // Неделя 0 — та, в которую попадает starts_on; считаем от её понедельника.
  const monday0 = startN - (isoWeekday(startsOn) - 1)
  let w = 0
  if (limit === Infinity) {
    // Прыжок к окну: вниз до кратного step; даты до lower отфильтруются в цикле.
    w = Math.floor(Math.floor((lowerN - monday0) / 7) / step) * step
  }
  const out: DateStr[] = []
  let count = 0
  for (; monday0 + w * 7 <= upperN; w += step) {
    for (const wd of weekdays) {
      const n = monday0 + w * 7 + wd - 1
      // Дни стартовой недели до starts_on — не повторения и не тратят счётчик 'after'.
      if (n < startN) continue
      if (count >= limit) return out
      count++
      if (n < lowerN) continue
      if (n > upperN) break
      out.push(fromDayNumber(n))
    }
  }
  return out
}

function expandMonthly(startsOn: DateStr, step: number, monthday: number, lower: DateStr, upper: DateStr, limit: number): DateStr[] {
  const startYm = monthIndex(startsOn)
  const upperYm = monthIndex(upper)
  let i = 0
  if (limit === Infinity) {
    i = Math.floor((monthIndex(lower) - startYm) / step) * step
  }
  const out: DateStr[] = []
  let count = 0
  for (; startYm + i <= upperYm; i += step) {
    const ym = startYm + i
    const y = Math.floor(ym / 12)
    const m = (ym % 12) + 1
    // Месяц без такого числа (31 февраля) пропускается, не сдвигаясь на 28-е.
    if (monthday > daysInMonth(y, m)) continue
    const d = dateOf(y, m, monthday)
    if (d < startsOn) continue
    if (count >= limit) break
    count++
    if (d < lower) continue
    if (d > upper) break
    out.push(d)
  }
  return out
}

function expandYearly(startsOn: DateStr, step: number, lower: DateStr, upper: DateStr, limit: number): DateStr[] {
  const yStart = Number(startsOn.slice(0, 4))
  const m = Number(startsOn.slice(5, 7))
  const day = Number(startsOn.slice(8, 10))
  const yUpper = Number(upper.slice(0, 4))
  let y = yStart
  if (limit === Infinity) {
    y = yStart + Math.floor((Number(lower.slice(0, 4)) - yStart) / step) * step
  }
  const out: DateStr[] = []
  let count = 0
  for (; y <= yUpper; y += step) {
    // 29 февраля в невисокосный год — год пропускается.
    if (day > daysInMonth(y, m)) continue
    const d = dateOf(y, m, day)
    // Дата < starts_on невозможна: месяц и число совпадают со starts_on.
    if (count >= limit) break
    count++
    if (d < lower) continue
    if (d > upper) break
    out.push(d)
  }
  return out
}

/** Индекс месяца на сплошной шкале: год × 12 + (месяц − 1). */
function monthIndex(d: DateStr): number {
  return Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1
}

function dateOf(y: number, m: number, day: number): DateStr {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
