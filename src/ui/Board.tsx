// Борд дня: укладка packDay, плитки позиционируются абсолютно — так переупаковка
// анимируется движением, а не перерисовкой. Движение гаснет при
// prefers-reduced-motion (tokens.css).

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { packDay, COLS } from '../domain/packing'
import type { Importance } from '../domain/types'

export const GAP = 4
export const MAX_CELL = 89

export type BoardItem = { id: string; importance: Importance; content: ReactNode }

export function useCellSize(cols: number): { ref: (el: HTMLElement | null) => void; cell: number; width: number } {
  const [cell, setCell] = useState(MAX_CELL)
  const observer = useRef<ResizeObserver | null>(null)

  const ref = (el: HTMLElement | null) => {
    observer.current?.disconnect()
    if (!el) return
    observer.current = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? 0
      if (w > 0) setCell(Math.min(MAX_CELL, Math.floor((w - (cols - 1) * GAP) / cols)))
    })
    observer.current.observe(el)
  }

  return { ref, cell, width: cell * cols + (cols - 1) * GAP }
}

export function Board({
  items,
  cols = COLS,
  cell,
  animate = true,
}: {
  items: BoardItem[]
  cols?: number
  cell: number
  animate?: boolean
}) {
  const placements = packDay(items, cols)
  const rows = placements.reduce((m, p) => Math.max(m, p.row + p.h), 0)
  const px = (n: number) => n * (cell + GAP)

  // При первом появлении не анимируем — иначе плитки съезжаются из угла.
  const mounted = useRef(false)
  useLayoutEffect(() => {
    mounted.current = true
  }, [])

  return (
    <div className="relative" style={{ height: rows === 0 ? 0 : px(rows) - GAP }}>
      {placements.map((p) => {
        const item = items.find((i) => i.id === p.id)!
        return (
          <div
            key={p.id}
            className="absolute"
            style={{
              left: px(p.col),
              top: px(p.row),
              width: p.w * cell + (p.w - 1) * GAP,
              height: p.h * cell + (p.h - 1) * GAP,
              transition:
                animate && mounted.current
                  ? 'left 300ms cubic-bezier(0.3, 1.1, 0.4, 1), top 300ms cubic-bezier(0.3, 1.1, 0.4, 1), width 300ms, height 300ms'
                  : undefined,
            }}
          >
            {item.content}
          </div>
        )
      })}
    </div>
  )
}
