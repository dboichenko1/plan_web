// Укладка плиток дня: first-fit сверху вниз, внутри строки слева направо.
// Поиск всегда с нулевой строки, поэтому дыры затыкаются сами — отдельного уплотнения нет.

import type { Importance, TaskState } from './types'

export const TILE = {
  1: { w: 1, h: 1 },
  2: { w: 2, h: 1 },
  3: { w: 2, h: 2 },
  4: { w: 4, h: 2 },
} as const

export const COLS = 4

export type Placement = { id: string; col: number; row: number; w: number; h: number }

export function packDay(
  tasks: ReadonlyArray<{ id: string; importance: Importance }>,
  cols: number = COLS,
): Placement[] {
  // Строки создаются лениво: отсутствующая строка целиком свободна.
  const grid: boolean[][] = []

  const fits = (col: number, row: number, w: number, h: number): boolean => {
    for (let r = row; r < row + h; r++) {
      const line = grid[r]
      if (line === undefined) continue
      for (let c = col; c < col + w; c++) {
        if (line[c]) return false
      }
    }
    return true
  }

  // Строки от grid.length и ниже пусты, поэтому плитка при w <= cols встаёт
  // не позже (0, grid.length).
  const findSpot = (w: number, h: number): { col: number; row: number } => {
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col + w <= cols; col++) {
        if (fits(col, row, w, h)) return { col, row }
      }
    }
    return { col: 0, row: grid.length }
  }

  const result: Placement[] = []
  for (const task of tasks) {
    const { w, h } = TILE[task.importance]
    // Иначе ни одна колонка не подойдёт и поиск строки не завершится.
    if (w > cols) throw new Error(`плитка ${w}×${h} шире сетки из ${cols} колонок`)

    const { col, row } = findSpot(w, h)
    for (let r = row; r < row + h; r++) {
      let line = grid[r]
      if (line === undefined) {
        line = new Array<boolean>(cols).fill(false)
        grid[r] = line
      }
      for (let c = col; c < col + w; c++) line[c] = true
    }
    result.push({ id: task.id, col, row, w, h })
  }
  return result
}

/** Ячейки под живыми задачами: ёмкость отвечает «сколько я на себя взял», серые и выполненные не в счёт. */
export function occupiedCells(tasks: ReadonlyArray<{ importance: Importance; state: TaskState }>): number {
  let sum = 0
  for (const t of tasks) {
    if (t.state !== 'live') continue
    const tile = TILE[t.importance]
    sum += tile.w * tile.h
  }
  return sum
}
