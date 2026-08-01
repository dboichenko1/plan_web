import type { Importance, Urgency } from './types'

// Минимальный зазор между соседними order_index; меньше — пора перенумеровать день.
export const MIN_GAP = 1e-6

export function orderIndexBetween(prev: number | null, next: number | null): number {
  if (prev === null) return next === null ? 0 : next - 1
  if (next === null) return prev + 1
  return (prev + next) / 2
}

export function isGapTooSmall(prev: number | null, next: number | null): boolean {
  return prev !== null && next !== null && next - prev < MIN_GAP
}

export function renumber(ids: ReadonlyArray<string>): { id: string; order_index: number }[] {
  return ids.map((id, i) => ({ id, order_index: i }))
}

export function naturalCompare(
  a: { urgency: Urgency; importance: Importance },
  b: { urgency: Urgency; importance: Importance },
): number {
  if (a.urgency !== b.urgency) return b.urgency - a.urgency
  return b.importance - a.importance
}

export function naturalOrderIndexes<
  T extends { id: string; urgency: Urgency; importance: Importance },
>(tasks: ReadonlyArray<T>): { id: string; order_index: number }[] {
  // Array.prototype.sort стабилен начиная с ES2019 — равные элементы сохраняют исходный порядок.
  const sorted = [...tasks].sort(naturalCompare)
  return renumber(sorted.map((t) => t.id))
}
