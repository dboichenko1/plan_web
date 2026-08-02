// Перетаскивание: dnd-kit c PointerSensor и задержкой 200 мс — она отделяет
// перетаскивание от скролла, HTML5 drag-and-drop в Safari на iOS не работает
//. touch-action: none ставится только на плитки, не на контейнер.

import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { TaskRow } from '../data/contract'

export type DragData =
  | { type: 'board-tile'; task: TaskRow }
  | { type: 'inbox-row'; task: TaskRow }

export function useBoardSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )
}

/** id дроп-зоны вставки перед открытой задачей с индексом i; 'slot:end' — в конец. */
export function slotId(index: number | 'end'): string {
  return `slot:${index}`
}

export function parseSlotId(id: string): number | 'end' | null {
  if (!id.startsWith('slot:')) return null
  const rest = id.slice(5)
  return rest === 'end' ? 'end' : Number(rest)
}
