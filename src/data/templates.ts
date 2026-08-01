// Повторяющиеся задачи (ТЗ §5.9): шаблон в task_templates, повторения —
// отдельные строки tasks с template_id и occurrence_on. Локальная материализация
// закрывает окно today+60 сразу, ночной pg_cron делает то же на сервере;
// уникальный индекс (template_id, occurrence_on) защищает от дублей.

import { db, type OutboxEntity } from './db'
import type { TaskRow, TaskTemplateRow } from './contract'
import type { DateStr, Importance, TimeStr, Urgency } from '../domain/types'
import { type Rule, expand } from '../domain/recurrence'
import { addDays, isoWeekday } from '../domain/date'
import { moveTaskToDay, softDeleteTask, updateTask } from './repo'
import { pokeSync } from './syncSignal'
import { WEEKDAYS_SHORT, plural } from '../ui/format'

/** Окно материализации вперёд, в днях (ТЗ §5.9). */
const HORIZON_DAYS = 60

function nowIso(): string {
  return new Date().toISOString()
}

async function enqueue(entity: OutboxEntity, entityId: string, payload: Record<string, unknown>): Promise<void> {
  await db.outbox.add({ entity, entity_id: entityId, op: 'upsert', payload, created_at: nowIso(), tries: 0 })
  pokeSync()
}

/** created_at/updated_at ставит сервер — в outbox их не кладём. */
function templatePayload(tpl: TaskTemplateRow): Record<string, unknown> {
  const { created_at, updated_at, ...rest } = tpl
  void created_at
  void updated_at
  return rest
}

/** Правило повторения из строки шаблона. */
export function templateRule(tpl: TaskTemplateRow): Rule {
  return {
    freq: tpl.freq,
    step: tpl.step,
    ...(tpl.byweekday && tpl.byweekday.length > 0 ? { byweekday: tpl.byweekday } : {}),
    ...(tpl.bymonthday !== null ? { bymonthday: tpl.bymonthday } : {}),
    starts_on: tpl.starts_on,
    ends:
      tpl.ends_mode === 'on' && tpl.ends_on
        ? { mode: 'on', on: tpl.ends_on }
        : tpl.ends_mode === 'after' && tpl.ends_after !== null
          ? { mode: 'after', after: tpl.ends_after }
          : { mode: 'never' },
  }
}

/** Поля будущих экземпляров + правило; всё, что нужно шаблону. */
export type NewTemplate = {
  title: string
  note?: string | null
  importance: Importance
  urgency_manual: Urgency
  category_id?: string | null
  due_time?: TimeStr | null
  remind_before?: number[]
  rule: Rule
}

export async function createTemplate(input: NewTemplate, userId: string, today: DateStr): Promise<void> {
  const ts = nowIso()
  const rule = input.rule
  const tpl: TaskTemplateRow = {
    id: crypto.randomUUID(),
    user_id: userId,
    title: input.title,
    note: input.note ?? null,
    importance: input.importance,
    urgency_manual: input.urgency_manual,
    category_id: input.category_id ?? null,
    due_time: input.due_time ?? null,
    remind_before: input.remind_before ?? [],
    freq: rule.freq,
    step: rule.step,
    byweekday: rule.freq === 'weekly' && rule.byweekday && rule.byweekday.length > 0 ? rule.byweekday : null,
    bymonthday:
      rule.freq === 'monthly' ? (rule.bymonthday ?? Number(rule.starts_on.slice(8, 10))) : null,
    starts_on: rule.starts_on,
    ends_mode: rule.ends.mode,
    ends_on: rule.ends.mode === 'on' ? rule.ends.on : null,
    ends_after: rule.ends.mode === 'after' ? rule.ends.after : null,
    materialized_through: null,
    archived_at: null,
    created_at: ts,
    updated_at: ts,
  }
  await db.task_templates.put(tpl)
  await enqueue('task_templates', tpl.id, templatePayload(tpl))
  await materializeTemplate(tpl.id, today)
}

/**
 * Создать недостающие экземпляры с max(starts_on, materialized_through+1)
 * по today+60 и подвинуть materialized_through. Повторный вызов — no-op:
 * существующие пары (template_id, occurrence_on) не дублируются.
 */
export async function materializeTemplate(templateId: string, today: DateStr): Promise<void> {
  const tpl = await db.task_templates.get(templateId)
  if (!tpl || tpl.archived_at) return
  const resume = tpl.materialized_through ? addDays(tpl.materialized_through, 1) : tpl.starts_on
  const from = resume > tpl.starts_on ? resume : tpl.starts_on
  const to = addDays(today, HORIZON_DAYS)
  if (from > to) return

  const dates = expand(templateRule(tpl), from, to)
  const existing = await db.tasks.where('template_id').equals(templateId).toArray()
  const taken = new Set(existing.map((t) => t.occurrence_on))
  for (const day of dates) {
    if (taken.has(day)) continue
    const ts = nowIso()
    const task: TaskRow = {
      id: crypto.randomUUID(),
      user_id: tpl.user_id,
      title: tpl.title,
      note: tpl.note,
      importance: tpl.importance,
      urgency_manual: tpl.urgency_manual,
      // Срок у экземпляра не задаём: срочность повторов ручная, а не от даты.
      due_on: null,
      due_time: tpl.due_time,
      remind_before: tpl.remind_before,
      scheduled_on: null,
      category_id: tpl.category_id,
      template_id: tpl.id,
      occurrence_on: day,
      order_index: 0,
      status: 'open',
      completed_at: null,
      urgency_at_completion: null,
      created_at: ts,
      updated_at: ts,
      deleted_at: null,
    }
    await db.tasks.put(task)
    // Кладём в день через repo: order_index — по естественному порядку (ТЗ §5.7).
    await moveTaskToDay(task.id, day, today)
  }
  await db.task_templates.update(templateId, { materialized_through: to, updated_at: nowIso() })
  const updated = await db.task_templates.get(templateId)
  if (updated) await enqueue('task_templates', templateId, templatePayload(updated))
}

/** «Только эту»: правится один экземпляр, template_id сохраняется. */
export async function editOnlyThis(taskId: string, patch: Partial<TaskRow>): Promise<void> {
  await updateTask(taskId, patch)
}

/**
 * «Эту и все следующие» (ТЗ §5.9): старый шаблон обрезается накануне этого
 * повторения, его будущие невыполненные экземпляры мягко удаляются, вместо них
 * создаётся и материализуется новый шаблон.
 */
export async function editThisAndFollowing(taskId: string, next: NewTemplate, today: DateStr): Promise<void> {
  const task = await db.tasks.get(taskId)
  if (!task || !task.template_id || !task.occurrence_on) return
  const occurrenceOn = task.occurrence_on
  const tpl = await db.task_templates.get(task.template_id)
  if (!tpl) return

  await db.task_templates.update(tpl.id, {
    ends_mode: 'on',
    ends_on: addDays(occurrenceOn, -1),
    updated_at: nowIso(),
  })
  const cut = await db.task_templates.get(tpl.id)
  if (cut) await enqueue('task_templates', tpl.id, templatePayload(cut))

  const instances = await db.tasks.where('template_id').equals(tpl.id).toArray()
  for (const t of instances) {
    if (t.occurrence_on && t.occurrence_on >= occurrenceOn && t.status === 'open' && !t.deleted_at) {
      await softDeleteTask(t.id)
    }
  }

  await createTemplate(next, task.user_id, today)
}

/** Шаблон в архив; невыполненные экземпляры мягко удалить, выполненные — история. */
export async function deleteTemplate(templateId: string): Promise<void> {
  const tpl = await db.task_templates.get(templateId)
  if (!tpl) return
  await db.task_templates.update(templateId, { archived_at: nowIso(), updated_at: nowIso() })
  const archived = await db.task_templates.get(templateId)
  if (archived) await enqueue('task_templates', templateId, templatePayload(archived))

  const instances = await db.tasks.where('template_id').equals(templateId).toArray()
  for (const t of instances) {
    if (t.status === 'open' && !t.deleted_at) await softDeleteTask(t.id)
  }
}

/** «Каждую неделю по вт, пт», «Каждые 2 месяца 31 числа», «Каждый день · до 31.12». */
export function describeRule(rule: Rule): string {
  const tail =
    rule.ends.mode === 'on'
      ? `до ${rule.ends.on.slice(8, 10)}.${rule.ends.on.slice(5, 7)}`
      : rule.ends.mode === 'after'
        ? `${rule.ends.after} ${plural(rule.ends.after, 'раз', 'раза', 'раз')}`
        : ''
  const base = freqPhrase(rule)
  return tail ? `${base} · ${tail}` : base
}

function freqPhrase(rule: Rule): string {
  const n = rule.step
  switch (rule.freq) {
    case 'daily':
      return n === 1 ? 'Каждый день' : `Каждые ${n} ${plural(n, 'день', 'дня', 'дней')}`
    case 'weekly': {
      const days =
        rule.byweekday && rule.byweekday.length > 0
          ? [...new Set(rule.byweekday)].sort((a, b) => a - b)
          : [isoWeekday(rule.starts_on)]
      const names = days.map((d) => WEEKDAYS_SHORT[d - 1] ?? '').join(', ')
      return n === 1
        ? `Каждую неделю по ${names}`
        : `Каждые ${n} ${plural(n, 'неделю', 'недели', 'недель')} по ${names}`
    }
    case 'monthly': {
      const day = rule.bymonthday ?? Number(rule.starts_on.slice(8, 10))
      return n === 1
        ? `Каждый месяц ${day} числа`
        : `Каждые ${n} ${plural(n, 'месяц', 'месяца', 'месяцев')} ${day} числа`
    }
    case 'yearly':
      return n === 1 ? 'Каждый год' : `Каждые ${n} ${plural(n, 'год', 'года', 'лет')}`
  }
}
