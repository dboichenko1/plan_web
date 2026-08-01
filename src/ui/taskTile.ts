// Сборка вью-модели плитки из строки задачи: состояние, срочность, подписи.

import type { CategoryRow, TaskRow } from '../data/contract'
import { daysHanging, taskState } from '../domain/state'
import { effectiveUrgency } from '../domain/urgency'
import type { DateStr } from '../domain/types'
import { tileCaption } from './format'
import type { TileData } from './Tile'

export function toTileData(
  task: TaskRow,
  today: DateStr,
  categories: ReadonlyMap<string, CategoryRow>,
): TileData {
  const category = task.category_id ? categories.get(task.category_id) : undefined
  return {
    id: task.id,
    title: task.title,
    importance: task.importance,
    urgency: effectiveUrgency(task, today),
    state: taskState(task, today),
    categoryIcon: category?.icon ?? null,
    caption: tileCaption(task.due_on, task.due_time, category?.name ?? null, today),
    hangingDays: daysHanging(task, today),
    repeating: task.template_id !== null,
  }
}
