import type { DateStr, TaskLike, Urgency } from './types'
import { daysBetween } from './date'

/**
 * Срочность по близости дедлайна; без due_on действует ручная.
 * ≤0 дней — 4 (горит), ≤3 — 3 (скоро), ≤7 — 2 (на неделе), дальше — 1.
 */
export function effectiveUrgency(
  task: Pick<TaskLike, 'due_on' | 'urgency_manual'>,
  today: DateStr,
): Urgency {
  const due = task.due_on
  if (due == null) return task.urgency_manual
  const days = daysBetween(today, due)
  if (days <= 0) return 4
  if (days <= 3) return 3
  if (days <= 7) return 2
  return 1
}
