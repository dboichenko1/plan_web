// Фильтр списков задач (макет 13). Чистые функции без Dexie и React:
// один и тот же applyFilter работает в инбоксе и в статистике, шторка
// фильтров только редактирует значение TaskFilter.

import type { TaskRow } from './contract'
import type { DateStr, Importance, Urgency } from '../domain/types'
import { taskState } from '../domain/state'
import { effectiveUrgency } from '../domain/urgency'
import { naturalCompare } from '../domain/ordering'

// Для фильтра expired схлопывается в slipped: пользователь видит одну кучу
// «слетевшие», сгоревший дедлайн — деталь отображения плитки, не отдельный ящик.
export type FilterTaskState = 'live' | 'slipped' | 'done'

export type FilterSort = 'natural' | 'due' | 'created'

export type TaskFilter = {
  /** Пустой список означает «все» — у каждой оси, не только у категорий. */
  categories: string[]
  tags: string[]
  urgency: Urgency[]
  importance: Importance[]
  states: FilterTaskState[]
  sort: FilterSort
}

export const EMPTY_FILTER: TaskFilter = {
  categories: [],
  tags: [],
  urgency: [],
  importance: [],
  states: [],
  sort: 'natural',
}

export function isEmptyFilter(f: TaskFilter): boolean {
  return (
    f.categories.length === 0 &&
    f.tags.length === 0 &&
    f.urgency.length === 0 &&
    f.importance.length === 0 &&
    f.states.length === 0 &&
    f.sort === 'natural'
  )
}

// Ключ «по сроку»: без срока — в конец, внутри одного дня задачи без времени
// идут после задач со временем. Строки сравниваются лексикографически.
function dueKey(t: TaskRow): string {
  if (!t.due_on) return '9999-99-99'
  return `${t.due_on} ${t.due_time ?? '99:99'}`
}

/**
 * Отфильтровать и отсортировать задачи. taskTags — карта task_id → tag_id[],
 * её собирает вызывающий (в шторке и инбоксе — из Dexie, в статистике — из RPC).
 */
export function applyFilter(
  tasks: TaskRow[],
  f: TaskFilter,
  today: DateStr,
  taskTags: Map<string, string[]>,
): TaskRow[] {
  const out = tasks.filter((t) => {
    // Мягко удалённое не показываем никогда — вызывающим не нужно помнить об этом.
    if (t.deleted_at !== null) return false
    if (
      f.categories.length > 0 &&
      (t.category_id === null || !f.categories.includes(t.category_id))
    )
      return false
    if (f.tags.length > 0) {
      const own = taskTags.get(t.id)
      if (!own || !f.tags.some((tag) => own.includes(tag))) return false
    }
    if (f.urgency.length > 0 && !f.urgency.includes(effectiveUrgency(t, today))) return false
    if (f.importance.length > 0 && !f.importance.includes(t.importance)) return false
    if (f.states.length > 0) {
      const s = taskState(t, today)
      const bucket: FilterTaskState = s === 'expired' ? 'slipped' : s
      if (!f.states.includes(bucket)) return false
    }
    return true
  })

  // Array.prototype.sort стабилен: при равных ключах входной порядок сохраняется,
  // поэтому «естественная» сортировка не перемешивает задачи внутри одного уровня.
  switch (f.sort) {
    case 'natural':
      out.sort((a, b) =>
        naturalCompare(
          { urgency: effectiveUrgency(a, today), importance: a.importance },
          { urgency: effectiveUrgency(b, today), importance: b.importance },
        ),
      )
      break
    case 'due':
      out.sort((a, b) => (dueKey(a) < dueKey(b) ? -1 : dueKey(a) > dueKey(b) ? 1 : 0))
      break
    case 'created':
      // Новые сверху; created_at — ISO-метка, лексикографическое сравнение корректно.
      out.sort((a, b) => (a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0))
      break
  }
  return out
}

/** Сколько задач пройдёт фильтр — для живого счётчика в кнопке «Показать N задач». */
export function countMatches(
  tasks: TaskRow[],
  f: TaskFilter,
  today: DateStr,
  taskTags: Map<string, string[]>,
): number {
  return applyFilter(tasks, f, today, taskTags).length
}
