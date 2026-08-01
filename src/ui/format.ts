// Русские подписи дат и сроков. Всё работает над строками 'YYYY-MM-DD'.

import { daysBetween, isoWeekday } from '../domain/date'
import type { DateStr, TimeStr } from '../domain/types'

export const WEEKDAYS = [
  'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье',
] as const

export const WEEKDAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const

const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const

const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
] as const

export function weekdayName(d: DateStr): string {
  return WEEKDAYS[isoWeekday(d) - 1] ?? ''
}

export function weekdayShort(d: DateStr): string {
  return WEEKDAYS_SHORT[isoWeekday(d) - 1] ?? ''
}

/** «14 августа» */
export function dateLong(d: DateStr): string {
  return `${Number(d.slice(8, 10))} ${MONTHS_GEN[Number(d.slice(5, 7)) - 1]}`
}

/** «14 авг» */
export function dateShort(d: DateStr): string {
  return `${Number(d.slice(8, 10))} ${MONTHS_SHORT[Number(d.slice(5, 7)) - 1]}`
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs >= 11 && abs <= 14) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

/** «3 дня висит» — констатация, не упрёк. */
export function hangingLabel(days: number): string {
  return `${days} ${plural(days, 'день', 'дня', 'дней')} висит`
}

/** Подпись срока на живой плитке: «сегодня 18:00», «завтра», «до пятницы», «14 авг». */
const WEEKDAYS_GEN = [
  'понедельника', 'вторника', 'среды', 'четверга', 'пятницы', 'субботы', 'воскресенья',
] as const

export function dueLabel(due_on: DateStr, due_time: TimeStr | null, today: DateStr): string {
  const days = daysBetween(today, due_on)
  const time = due_time ? ` ${due_time.slice(0, 5)}` : ''
  if (days === 0) return `сегодня${time}`
  if (days === 1) return `завтра${time}`
  if (days > 1 && days <= 6) return `до ${WEEKDAYS_GEN[isoWeekday(due_on) - 1]}${time}`
  return `${dateShort(due_on)}${time}`
}

export function tileCaption(
  due_on: DateStr | null,
  due_time: TimeStr | null,
  categoryName: string | null,
  today: DateStr,
): string {
  const parts: string[] = []
  if (due_on) parts.push(dueLabel(due_on, due_time, today))
  if (categoryName) parts.push(categoryName.toLowerCase())
  return parts.join(' · ')
}
