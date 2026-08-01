import { describe, it, expect } from 'vitest'
import {
  MIN_GAP,
  orderIndexBetween,
  isGapTooSmall,
  renumber,
  naturalCompare,
  naturalOrderIndexes,
} from './ordering'
import type { Importance, Urgency } from './types'

type Ranked = { urgency: Urgency; importance: Importance }
type RankedTask = Ranked & { id: string }

describe('orderIndexBetween', () => {
  it('оба null — первая задача дня получает 0', () => {
    expect(orderIndexBetween(null, null)).toBe(0)
  })

  it('prev null — на единицу меньше next', () => {
    expect(orderIndexBetween(null, 5)).toBe(4)
    expect(orderIndexBetween(null, 0)).toBe(-1)
  })

  it('next null — на единицу больше prev', () => {
    expect(orderIndexBetween(3, null)).toBe(4)
    expect(orderIndexBetween(-2, null)).toBe(-1)
  })

  it('оба заданы — середина', () => {
    expect(orderIndexBetween(0, 1)).toBe(0.5)
    expect(orderIndexBetween(-4, 4)).toBe(0)
    expect(orderIndexBetween(1.25, 1.75)).toBe(1.5)
  })
})

describe('isGapTooSmall', () => {
  it('ровно MIN_GAP — не слишком мал', () => {
    expect(isGapTooSmall(0, MIN_GAP)).toBe(false)
    expect(isGapTooSmall(1, 1 + MIN_GAP + 1e-9)).toBe(false)
  })

  it('чуть меньше MIN_GAP — слишком мал', () => {
    expect(isGapTooSmall(0, MIN_GAP / 2)).toBe(true)
    expect(isGapTooSmall(0.5, 0.5)).toBe(true)
  })

  it('отрицательный зазор (next раньше prev) — тоже сигнал', () => {
    expect(isGapTooSmall(2, 1)).toBe(true)
  })

  it('null-ветки — зазор с краем списка не бывает мал', () => {
    expect(isGapTooSmall(null, 0)).toBe(false)
    expect(isGapTooSmall(0, null)).toBe(false)
    expect(isGapTooSmall(null, null)).toBe(false)
  })
})

describe('renumber', () => {
  it('пустой список — пустой результат', () => {
    expect(renumber([])).toEqual([])
  })

  it('целые 0, 1, 2 в заданном порядке', () => {
    expect(renumber(['b', 'a', 'c'])).toEqual([
      { id: 'b', order_index: 0 },
      { id: 'a', order_index: 1 },
      { id: 'c', order_index: 2 },
    ])
  })
})

describe('naturalCompare', () => {
  it('более срочная — раньше', () => {
    expect(naturalCompare({ urgency: 4, importance: 1 }, { urgency: 1, importance: 4 })).toBeLessThan(0)
    expect(naturalCompare({ urgency: 1, importance: 4 }, { urgency: 4, importance: 1 })).toBeGreaterThan(0)
  })

  it('при равной срочности более важная — раньше', () => {
    expect(naturalCompare({ urgency: 2, importance: 4 }, { urgency: 2, importance: 1 })).toBeLessThan(0)
    expect(naturalCompare({ urgency: 2, importance: 1 }, { urgency: 2, importance: 4 })).toBeGreaterThan(0)
  })

  it('равные срочность и важность — 0', () => {
    expect(naturalCompare({ urgency: 3, importance: 2 }, { urgency: 3, importance: 2 })).toBe(0)
  })
})

describe('naturalOrderIndexes', () => {
  it('срочность по убыванию, внутри — важность по убыванию, индексы целые', () => {
    const tasks: RankedTask[] = [
      { id: 'low', urgency: 1, importance: 4 },
      { id: 'mid', urgency: 3, importance: 1 },
      { id: 'top', urgency: 3, importance: 4 },
      { id: 'urgent', urgency: 4, importance: 1 },
    ]
    expect(naturalOrderIndexes(tasks)).toEqual([
      { id: 'urgent', order_index: 0 },
      { id: 'top', order_index: 1 },
      { id: 'mid', order_index: 2 },
      { id: 'low', order_index: 3 },
    ])
  })

  it('стабильность: равные по срочности и важности не меняются местами', () => {
    const tasks: RankedTask[] = [
      { id: 'first', urgency: 2, importance: 3 },
      { id: 'second', urgency: 2, importance: 3 },
      { id: 'third', urgency: 2, importance: 3 },
    ]
    expect(naturalOrderIndexes(tasks).map((r) => r.id)).toEqual(['first', 'second', 'third'])
  })

  it('не мутирует входной массив', () => {
    const tasks: RankedTask[] = [
      { id: 'a', urgency: 1, importance: 1 },
      { id: 'b', urgency: 4, importance: 4 },
    ]
    naturalOrderIndexes(tasks)
    expect(tasks.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('пустой список — пустой результат', () => {
    expect(naturalOrderIndexes([])).toEqual([])
  })
})

describe('сценарий деградации зазора', () => {
  it('вставки между 0 и 1 сужают зазор вдвое; после 20 вставок isGapTooSmall срабатывает, renumber чинит', () => {
    const prev = 0
    let next = 1
    let inserts = 0
    // Ограничитель на случай регрессии, чтобы тест не завис.
    while (!isGapTooSmall(prev, next) && inserts < 64) {
      next = orderIndexBetween(prev, next)
      inserts += 1
    }
    // Зазор после n вставок равен 2^-n; 2^-20 ≈ 9.54e-7 < MIN_GAP.
    expect(inserts).toBe(20)
    expect(next - prev).toBeLessThan(MIN_GAP)
    expect(next - prev).toBeGreaterThan(0)

    const repaired = renumber(['head', 'inserted', 'tail'])
    expect(repaired).toEqual([
      { id: 'head', order_index: 0 },
      { id: 'inserted', order_index: 1 },
      { id: 'tail', order_index: 2 },
    ])
    expect(isGapTooSmall(0, 1)).toBe(false)
  })
})
