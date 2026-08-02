// Слой данных статистики. С настроенным Supabase — RPC-функции из
// миграции 20260801000006_stats.sql (время группируется в поясе профиля на
// сервере). Без него — эквивалентный расчёт по Dexie для демо-режима:
// пояс берётся локальный, это dev-режим и точность пояса тут не критична.
// Формы ответов обоих путей совпадают.

import { db } from './db'
import { supabase, supabaseConfigured } from './supabase'
import type { TaskRow } from './contract'
import { addDays, daysBetween, daysInMonth, isoWeekday } from '../domain/date'
import type { DateStr } from '../domain/types'

export type Period = { from: DateStr; to: DateStr }

export type StatsSummary = {
  done_count: number
  prev_done_count: number
  fire_index: number | null
  prev_fire_index: number | null
}

export type SurvivalRow = { scheduled_on: DateStr; survival: number }

export type SlippedRow = {
  category_id: string | null
  category_name: string | null
  slipped_count: number
}

export type RhythmCell = { dow: number; slot: number; done_count: number }

export type CategoryCount = {
  category_id: string | null
  category_name: string | null
  done_count: number
}

export type MonthCategoryCount = {
  month: string /* 'YYYY-MM' */
  category_id: string | null
  category_name: string | null
  done_count: number
}

export type MatrixCell = {
  urgent: boolean
  important: boolean
  done_count: number
  share: number
}

export type LeadTimeRow = {
  category_id: string | null
  category_name: string | null
  median_days: number
}

export type TagCount = { tag_id: string; tag_name: string; done_count: number }

/** Календарный период: день, неделя с понедельника, календарный месяц. */
export function periodFor(kind: 'day' | 'week' | 'month', today: DateStr): Period {
  if (kind === 'day') return { from: today, to: today }
  if (kind === 'week') {
    const from = addDays(today, 1 - isoWeekday(today))
    return { from, to: addDays(from, 6) }
  }
  const last = daysInMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)))
  return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-${String(last).padStart(2, '0')}` }
}

// --- Путь Supabase -------------------------------------------------------

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

// --- Локальные помощники (демо) ------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Календарная дата ISO-момента в локальном поясе браузера. */
function localDateOf(iso: string): DateStr {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function localToday(): DateStr {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

type DoneTask = TaskRow & { completed_at: string }

/** Выполненные в периоде: completed_at не null и его локальная дата в границах. */
async function doneInPeriod(p: Period): Promise<DoneTask[]> {
  const rows = await db.tasks.where('status').equals('done').toArray()
  return rows.filter((t): t is DoneTask => {
    if (t.deleted_at || t.completed_at === null) return false
    const d = localDateOf(t.completed_at)
    return d >= p.from && d <= p.to
  })
}

async function categoryNames(): Promise<Map<string, string>> {
  const cats = await db.categories.toArray()
  return new Map(cats.map((c) => [c.id, c.name]))
}

/** Группировка по категории с подстановкой имени; null — «без категории». */
function groupByCategory<T>(
  rows: TaskRow[],
  names: Map<string, string>,
  make: (category_id: string | null, category_name: string | null, tasks: TaskRow[]) => T,
): T[] {
  const groups = new Map<string, TaskRow[]>()
  for (const t of rows) {
    const key = t.category_id ?? ''
    const list = groups.get(key)
    if (list) list.push(t)
    else groups.set(key, [t])
  }
  return [...groups.entries()].map(([key, tasks]) => {
    const id = key === '' ? null : key
    return make(id, id === null ? null : (names.get(id) ?? null), tasks)
  })
}

function fireIndex(rows: TaskRow[]): number | null {
  if (rows.length === 0) return null
  return rows.filter((t) => t.urgency_at_completion === 4).length / rows.length
}

/** Медиана как percentile_cont(0.5): линейная интерполяция между соседями. */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = (s.length - 1) / 2
  const lo = s[Math.floor(mid)] ?? 0
  const hi = s[Math.ceil(mid)] ?? 0
  return (lo + hi) / 2
}

// --- Функции статистики ---------------------------------------------------

export async function statsSummary(p: Period): Promise<StatsSummary> {
  if (supabaseConfigured) {
    const rows = await rpc<StatsSummary[]>('stats_summary', { from_d: p.from, to_d: p.to })
    return rows[0] ?? { done_count: 0, prev_done_count: 0, fire_index: null, prev_fire_index: null }
  }
  const len = daysBetween(p.from, p.to) + 1
  const cur = await doneInPeriod(p)
  const prev = await doneInPeriod({ from: addDays(p.from, -len), to: addDays(p.from, -1) })
  return {
    done_count: cur.length,
    prev_done_count: prev.length,
    fire_index: fireIndex(cur),
    prev_fire_index: fireIndex(prev),
  }
}

export async function statsSurvival(p: Period): Promise<SurvivalRow[]> {
  if (supabaseConfigured) {
    return rpc<SurvivalRow[]>('stats_survival', { from_d: p.from, to_d: p.to })
  }
  const rows = await db.tasks
    .where('scheduled_on')
    .between(p.from, p.to, true, true)
    .and((t) => !t.deleted_at)
    .toArray()
  const byDay = new Map<DateStr, { total: number; done: number }>()
  for (const t of rows) {
    if (!t.scheduled_on) continue
    const e = byDay.get(t.scheduled_on) ?? { total: 0, done: 0 }
    e.total++
    if (t.status === 'done' && t.completed_at && localDateOf(t.completed_at) <= t.scheduled_on) e.done++
    byDay.set(t.scheduled_on, e)
  }
  return [...byDay.entries()]
    .map(([scheduled_on, e]) => ({ scheduled_on, survival: e.done / e.total }))
    .sort((a, b) => (a.scheduled_on < b.scheduled_on ? -1 : 1))
}

export async function statsSlipped(p: Period): Promise<SlippedRow[]> {
  if (supabaseConfigured) {
    return rpc<SlippedRow[]>('stats_slipped', { from_d: p.from, to_d: p.to })
  }
  const today = localToday()
  const rows = (
    await db.tasks.where('scheduled_on').between(p.from, p.to, true, true).toArray()
  ).filter(
    (t) =>
      !t.deleted_at &&
      t.scheduled_on !== null &&
      t.scheduled_on < today &&
      !(t.status === 'done' && t.completed_at && localDateOf(t.completed_at) <= t.scheduled_on),
  )
  const names = await categoryNames()
  return groupByCategory(rows, names, (category_id, category_name, tasks) => ({
    category_id,
    category_name,
    slipped_count: tasks.length,
  })).sort((a, b) => b.slipped_count - a.slipped_count)
}

export async function statsRhythm(p: Period, categoryId?: string): Promise<RhythmCell[]> {
  if (supabaseConfigured) {
    return categoryId === undefined
      ? rpc<RhythmCell[]>('stats_rhythm', { from_d: p.from, to_d: p.to })
      : rpc<RhythmCell[]>('stats_rhythm_category', { from_d: p.from, to_d: p.to, cat: categoryId })
  }
  const rows = (await doneInPeriod(p)).filter(
    (t) => categoryId === undefined || t.category_id === categoryId,
  )
  const cells = new Map<string, RhythmCell>()
  for (const t of rows) {
    const dow = isoWeekday(localDateOf(t.completed_at))
    const slot = Math.floor(new Date(t.completed_at).getHours() / 4)
    const key = `${dow}:${slot}`
    const cell = cells.get(key)
    if (cell) cell.done_count++
    else cells.set(key, { dow, slot, done_count: 1 })
  }
  return [...cells.values()]
}

export async function statsByCategory(p: Period): Promise<CategoryCount[]> {
  if (supabaseConfigured) {
    return rpc<CategoryCount[]>('stats_by_category', { from_d: p.from, to_d: p.to })
  }
  const names = await categoryNames()
  return groupByCategory(await doneInPeriod(p), names, (category_id, category_name, tasks) => ({
    category_id,
    category_name,
    done_count: tasks.length,
  })).sort((a, b) => b.done_count - a.done_count)
}

export async function statsByMonth(p: Period): Promise<MonthCategoryCount[]> {
  if (supabaseConfigured) {
    return rpc<MonthCategoryCount[]>('stats_by_month', { from_d: p.from, to_d: p.to })
  }
  const names = await categoryNames()
  const byMonth = new Map<string, DoneTask[]>()
  for (const t of await doneInPeriod(p)) {
    const month = localDateOf(t.completed_at).slice(0, 7)
    const list = byMonth.get(month)
    if (list) list.push(t)
    else byMonth.set(month, [t])
  }
  const out: MonthCategoryCount[] = []
  for (const [month, tasks] of [...byMonth.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const groups = groupByCategory(tasks, names, (category_id, category_name, list) => ({
      month,
      category_id,
      category_name,
      done_count: list.length,
    })).sort((a, b) => b.done_count - a.done_count)
    out.push(...groups)
  }
  return out
}

export async function statsMatrix(p: Period): Promise<MatrixCell[]> {
  if (supabaseConfigured) {
    return rpc<MatrixCell[]>('stats_matrix', { from_d: p.from, to_d: p.to })
  }
  const rows = await doneInPeriod(p)
  const counts = new Map<string, MatrixCell>()
  for (const t of rows) {
    // Срочное — закрыто в срочности 3–4 (снимок или ручная), важное — 2×2 и больше.
    const urgent = (t.urgency_at_completion ?? t.urgency_manual) >= 3
    const important = t.importance >= 3
    const key = `${urgent}:${important}`
    const cell = counts.get(key)
    if (cell) cell.done_count++
    else counts.set(key, { urgent, important, done_count: 1, share: 0 })
  }
  for (const cell of counts.values()) cell.share = cell.done_count / rows.length
  return [...counts.values()]
}

export async function statsLeadTime(p: Period): Promise<LeadTimeRow[]> {
  if (supabaseConfigured) {
    return rpc<LeadTimeRow[]>('stats_lead_time', { from_d: p.from, to_d: p.to })
  }
  const names = await categoryNames()
  return groupByCategory(await doneInPeriod(p), names, (category_id, category_name, tasks) => ({
    category_id,
    category_name,
    median_days: median(
      tasks.map((t) => (Date.parse(t.completed_at ?? '') - Date.parse(t.created_at)) / 86_400_000),
    ),
  })).sort((a, b) => b.median_days - a.median_days)
}

export async function statsTopTags(p: Period, n: number): Promise<TagCount[]> {
  if (supabaseConfigured) {
    return rpc<TagCount[]>('stats_top_tags', { from_d: p.from, to_d: p.to, n })
  }
  const doneIds = new Set((await doneInPeriod(p)).map((t) => t.id))
  const links = (await db.task_tags.toArray()).filter((l) => doneIds.has(l.task_id))
  const tagNames = new Map((await db.tags.toArray()).map((t) => [t.id, t.name]))
  const counts = new Map<string, number>()
  for (const l of links) counts.set(l.tag_id, (counts.get(l.tag_id) ?? 0) + 1)
  return [...counts.entries()]
    .map(([tag_id, done_count]) => ({ tag_id, tag_name: tagNames.get(tag_id) ?? '', done_count }))
    .sort((a, b) => b.done_count - a.done_count || (a.tag_name < b.tag_name ? -1 : 1))
    .slice(0, n)
}
