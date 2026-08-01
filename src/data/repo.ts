// Мутации: пишем в Dexie, кладём в outbox, UI обновляется сразу и никогда
// не ждёт сети (ТЗ §7). Отправкой занимается sync.ts.

import { db, type OutboxEntity } from './db'
import type { TaskRow } from './contract'
import type { DateStr, Importance, Urgency } from '../domain/types'
import { effectiveUrgency } from '../domain/urgency'
import { taskState } from '../domain/state'
import { naturalCompare } from '../domain/ordering'
import { pokeSync } from './syncSignal'

function nowIso(): string {
  return new Date().toISOString()
}

async function enqueue(
  entity: OutboxEntity,
  entityId: string,
  payload: Record<string, unknown>,
  op: 'upsert' | 'delete' = 'upsert',
): Promise<void> {
  await db.outbox.add({ entity, entity_id: entityId, op, payload, created_at: nowIso(), tries: 0 })
  pokeSync()
}

export type NewTask = {
  user_id: string
  title: string
  note?: string | null
  importance: Importance
  urgency_manual: Urgency
  due_on?: DateStr | null
  due_time?: string | null
  remind_before?: number[]
  scheduled_on?: DateStr | null
  category_id?: string | null
}

/** order_index для вставки в день по естественному порядку (ТЗ §5.7). */
async function orderIndexFor(task: Pick<TaskRow, 'user_id'>, day: DateStr | null, urgency: Urgency, importance: Importance, today: DateStr): Promise<number> {
  if (!day) return 0
  const dayTasks = (await db.tasks.where('scheduled_on').equals(day).toArray())
    .filter((t) => t.user_id === task.user_id && !t.deleted_at && t.status === 'open')
    .sort((a, b) => a.order_index - b.order_index)
  const me = { urgency, importance }
  let prev: number | null = null
  let next: number | null = null
  for (const t of dayTasks) {
    const other = { urgency: effectiveUrgency(t, today), importance: t.importance }
    if (naturalCompare(other, me) <= 0) {
      prev = t.order_index
    } else {
      next = t.order_index
      break
    }
  }
  if (prev === null && next === null) return 0
  if (prev === null) return (next as number) - 1
  if (next === null) return prev + 1
  return (prev + next) / 2
}

export async function createTask(input: NewTask, today: DateStr): Promise<TaskRow> {
  const ts = nowIso()
  const urgency = input.due_on
    ? effectiveUrgency({ due_on: input.due_on, urgency_manual: input.urgency_manual }, today)
    : input.urgency_manual
  const task: TaskRow = {
    id: crypto.randomUUID(),
    user_id: input.user_id,
    title: input.title,
    note: input.note ?? null,
    importance: input.importance,
    urgency_manual: input.urgency_manual,
    due_on: input.due_on ?? null,
    due_time: input.due_time ?? null,
    remind_before: input.remind_before ?? [],
    scheduled_on: input.scheduled_on ?? null,
    category_id: input.category_id ?? null,
    template_id: null,
    occurrence_on: null,
    order_index: await orderIndexFor(
      { user_id: input.user_id },
      input.scheduled_on ?? null,
      urgency,
      input.importance,
      today,
    ),
    status: 'open',
    completed_at: null,
    urgency_at_completion: null,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  }
  await db.tasks.put(task)
  await enqueue('tasks', task.id, taskPayload(task))
  return task
}

/** В outbox не кладём created_at/updated_at: их ставит сервер. */
function taskPayload(task: TaskRow): Record<string, unknown> {
  const { created_at, updated_at, ...rest } = task
  void created_at
  void updated_at
  return rest
}

export async function updateTask(id: string, patch: Partial<TaskRow>): Promise<void> {
  await db.tasks.update(id, { ...patch, updated_at: nowIso() })
  const task = await db.tasks.get(id)
  if (task) await enqueue('tasks', id, taskPayload(task))
}

export async function completeTask(id: string, today: DateStr): Promise<void> {
  const task = await db.tasks.get(id)
  if (!task || task.status === 'done') return
  await updateTask(id, {
    status: 'done',
    completed_at: nowIso(),
    urgency_at_completion: effectiveUrgency(task, today),
  })
}

export async function reopenTask(id: string): Promise<void> {
  await updateTask(id, { status: 'open', completed_at: null, urgency_at_completion: null })
}

export async function softDeleteTask(id: string): Promise<void> {
  await updateTask(id, { deleted_at: nowIso() })
}

/** Перенос в день: обычное изменение scheduled_on (ТЗ §5.6), порядок — естественный. */
export async function moveTaskToDay(id: string, day: DateStr | null, today: DateStr): Promise<void> {
  const task = await db.tasks.get(id)
  if (!task) return
  const urgency = effectiveUrgency(task, today)
  const order_index = await orderIndexFor(task, day, urgency, task.importance, today)
  await updateTask(id, { scheduled_on: day, order_index })
}

export async function setTaskOrder(id: string, order_index: number): Promise<void> {
  await updateTask(id, { order_index })
}

/** «Разложить заново»: пересчитать порядок дня по естественному правилу. */
export async function relayoutDay(userId: string, day: DateStr, today: DateStr): Promise<void> {
  const dayTasks = (await db.tasks.where('scheduled_on').equals(day).toArray())
    .filter((t) => t.user_id === userId && !t.deleted_at && t.status === 'open')
    .sort((a, b) => a.order_index - b.order_index)
  const sorted = [...dayTasks].sort((a, b) =>
    naturalCompare(
      { urgency: effectiveUrgency(a, today), importance: a.importance },
      { urgency: effectiveUrgency(b, today), importance: b.importance },
    ),
  )
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]!
    if (t.order_index !== i) await updateTask(t.id, { order_index: i })
  }
}

/** Перенумеровать день целыми, когда зазор order_index выродился. */
export async function renumberDay(userId: string, day: DateStr): Promise<void> {
  const dayTasks = (await db.tasks.where('scheduled_on').equals(day).toArray())
    .filter((t) => t.user_id === userId && !t.deleted_at)
    .sort((a, b) => a.order_index - b.order_index)
  for (let i = 0; i < dayTasks.length; i++) {
    const t = dayTasks[i]!
    if (t.order_index !== i) await updateTask(t.id, { order_index: i })
  }
}

export function stateOf(task: TaskRow, today: DateStr) {
  return taskState(task, today)
}
