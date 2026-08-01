import type { DateStr, TaskLike, TaskState } from './types'
import { daysBetween } from './date'

// Порядок проверок — часть контракта (ТЗ §5.2): done перекрывает всё,
// expired перекрывает slipped. Срок «сегодня» ещё не сгорел: только строго < today.
export function taskState(task: TaskLike, today: DateStr): TaskState {
  if (task.status === 'done') return 'done'
  if (task.due_on && task.due_on < today) return 'expired'
  if (task.scheduled_on && task.scheduled_on < today) return 'slipped'
  return 'live'
}

// ТЗ §5.4: висит с due_on, если тот уже в прошлом, иначе со scheduled_on.
export function daysHanging(task: TaskLike, today: DateStr): number {
  const from = task.due_on && task.due_on < today ? task.due_on : task.scheduled_on
  if (!from) return 0
  return daysBetween(from, today)
}
