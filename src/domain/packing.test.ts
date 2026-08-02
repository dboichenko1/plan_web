import { describe, expect, it } from 'vitest'
import { COLS, occupiedCells, packDay } from './packing'
import type { Placement } from './packing'
import type { Importance, TaskState } from './types'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// ASCII-рендер укладки: буква — индекс задачи во входе (A — первая), '.' — пустая ячейка.
function draw(placements: ReadonlyArray<Placement>, ids: ReadonlyArray<string>, cols: number): string[] {
  const height = placements.reduce((max, p) => Math.max(max, p.row + p.h), 0)
  const grid: string[][] = []
  for (let r = 0; r < height; r++) grid.push(new Array<string>(cols).fill('.'))
  for (const p of placements) {
    const letter = LETTERS[ids.indexOf(p.id)] ?? '?'
    for (let r = p.row; r < p.row + p.h; r++) {
      const line = grid[r]
      if (line === undefined) continue
      for (let c = p.col; c < p.col + p.w; c++) line[c] = letter
    }
  }
  return grid.map((line) => line.join(''))
}

function tasksOf(importances: ReadonlyArray<Importance>): Array<{ id: string; importance: Importance }> {
  return importances.map((importance, i) => ({ id: `t${i}`, importance }))
}

function snapshot(importances: ReadonlyArray<Importance>, cols: number = COLS): string[] {
  const tasks = tasksOf(importances)
  return draw(packDay(tasks, cols), tasks.map((t) => t.id), cols)
}

describe('packDay', () => {
  it('пустой день даёт пустую укладку', () => {
    expect(packDay([])).toEqual([])
  })

  it('одна ключевая занимает 4×2 с верхнего левого угла', () => {
    expect(snapshot([4])).toEqual(['AAAA', 'AAAA'])
    expect(packDay([{ id: 't0', importance: 4 }])).toEqual([{ id: 't0', col: 0, row: 0, w: 4, h: 2 }])
  })

  it('четыре мелочи встают в один ряд', () => {
    expect(snapshot([1, 1, 1, 1])).toEqual(['ABCD'])
  })

  it('ключевая после мелочи уходит на новую строку целиком', () => {
    expect(snapshot([1, 4])).toEqual(['A...', 'BBBB', 'BBBB'])
  })

  it('дыра под широкой плиткой затыкается мелочью', () => {
    expect(snapshot([2, 3, 1])).toEqual(['AABB', 'C.BB'])
  })

  it('канонический пример: [4,3,1,1,2]', () => {
    expect(snapshot([4, 3, 1, 1, 2])).toEqual(['AAAA', 'AAAA', 'BBCD', 'BBEE'])
  })

  it('переполнение сверх 32 ячеек: сетка растёт до 10 строк, все уложены', () => {
    const importances = new Array<Importance>(9).fill(3)
    const placements = packDay(tasksOf(importances))
    expect(placements).toHaveLength(9)
    expect(snapshot(importances)).toEqual([
      'AABB',
      'AABB',
      'CCDD',
      'CCDD',
      'EEFF',
      'EEFF',
      'GGHH',
      'GGHH',
      'II..',
      'II..',
    ])
  })

  it('cols=8: те же задачи укладываются шире', () => {
    expect(snapshot([4, 3, 1, 1, 2], 8)).toEqual(['AAAABBCD', 'AAAABBEE'])
  })

  it('детерминизм: одинаковый вход — идентичный выход', () => {
    const tasks = tasksOf([4, 3, 1, 1, 2, 3, 1])
    expect(packDay(tasks)).toEqual(packDay(tasks))
  })

  it('плитка шире сетки — ошибка, а не вечный поиск', () => {
    expect(() => packDay([{ id: 'x', importance: 4 }], 2)).toThrow('шире сетки')
  })
})

describe('occupiedCells', () => {
  it('пустой список даёт 0', () => {
    expect(occupiedCells([])).toBe(0)
  })

  it('считаются только live, серые и выполненные не входят', () => {
    const tasks: Array<{ importance: Importance; state: TaskState }> = [
      { importance: 4, state: 'live' }, // 8
      { importance: 3, state: 'slipped' },
      { importance: 2, state: 'expired' },
      { importance: 1, state: 'done' },
      { importance: 3, state: 'live' }, // 4
      { importance: 2, state: 'live' }, // 2
      { importance: 1, state: 'live' }, // 1
    ]
    expect(occupiedCells(tasks)).toBe(15)
  })
})
