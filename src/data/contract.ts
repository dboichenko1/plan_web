// Контракт схемы между фронтендом и базой. Лежит в публичном репозитории —
// он всё равно виден в devtools. Приватный репозиторий сверяет его с фактической
// схемой контрактным тестом (contract_snapshot()); расхождение роняет тест.
//
// type — udt_name постгреса; nullable — is_nullable; default — есть ли default.

import type { DateStr, Importance, TimeStr, Urgency } from '../domain/types'

type Col = { type: string; nullable: boolean; default: boolean }

const uuid = (opts: Partial<Col> = {}): Col => ({ type: 'uuid', nullable: false, default: false, ...opts })
const text = (opts: Partial<Col> = {}): Col => ({ type: 'text', nullable: false, default: false, ...opts })
const int2 = (opts: Partial<Col> = {}): Col => ({ type: 'int2', nullable: false, default: false, ...opts })
const date = (opts: Partial<Col> = {}): Col => ({ type: 'date', nullable: true, default: false, ...opts })
const time = (opts: Partial<Col> = {}): Col => ({ type: 'time', nullable: true, default: false, ...opts })
const timestamptz = (opts: Partial<Col> = {}): Col => ({ type: 'timestamptz', nullable: false, default: true, ...opts })

export const CONTRACT: Record<string, Record<string, Col>> = {
  profiles: {
    id: uuid(),
    timezone: text({ default: true }),
    day_capacity: int2({ default: true }),
    week_starts_on: int2({ default: true }),
    theme_mode: text({ default: true }),
    theme_dark_id: text({ default: true }),
    theme_light_id: text({ default: true }),
    created_at: timestamptz(),
    updated_at: timestamptz(),
  },
  categories: {
    id: uuid({ default: true }),
    user_id: uuid(),
    name: text(),
    icon: text(),
    sort_order: int2({ default: true }),
    archived_at: timestamptz({ nullable: true, default: false }),
    updated_at: timestamptz(),
  },
  tags: {
    id: uuid({ default: true }),
    user_id: uuid(),
    name: text(),
    updated_at: timestamptz(),
  },
  task_templates: {
    id: uuid({ default: true }),
    user_id: uuid(),
    title: text(),
    note: text({ nullable: true }),
    importance: int2({ default: true }),
    urgency_manual: int2({ default: true }),
    category_id: uuid({ nullable: true }),
    due_time: time(),
    remind_before: { type: '_int4', nullable: false, default: true },
    freq: text(),
    step: int2({ default: true }),
    byweekday: { type: '_int2', nullable: true, default: false },
    bymonthday: int2({ nullable: true }),
    starts_on: date({ nullable: false }),
    ends_mode: text({ default: true }),
    ends_on: date(),
    ends_after: int2({ nullable: true }),
    materialized_through: date(),
    archived_at: timestamptz({ nullable: true, default: false }),
    created_at: timestamptz(),
    updated_at: timestamptz(),
  },
  tasks: {
    id: uuid({ default: true }),
    user_id: uuid(),
    title: text(),
    note: text({ nullable: true }),
    importance: int2({ default: true }),
    urgency_manual: int2({ default: true }),
    due_on: date(),
    due_time: time(),
    remind_before: { type: '_int4', nullable: false, default: true },
    scheduled_on: date(),
    category_id: uuid({ nullable: true }),
    template_id: uuid({ nullable: true }),
    occurrence_on: date(),
    order_index: { type: 'float8', nullable: false, default: true },
    status: text({ default: true }),
    completed_at: timestamptz({ nullable: true, default: false }),
    urgency_at_completion: int2({ nullable: true }),
    created_at: timestamptz(),
    updated_at: timestamptz(),
    deleted_at: timestamptz({ nullable: true, default: false }),
  },
  task_tags: {
    task_id: uuid(),
    tag_id: uuid(),
    user_id: uuid(),
  },
  push_subscriptions: {
    id: uuid({ default: true }),
    user_id: uuid(),
    endpoint: text(),
    p256dh: text(),
    auth: text(),
    device_label: text({ nullable: true }),
    last_seen_at: timestamptz(),
    created_at: timestamptz(),
  },
  reminder_log: {
    task_id: uuid(),
    offset_minutes: { type: 'int4', nullable: false, default: false },
    sent_at: timestamptz(),
  },
}

// Строки таблиц, как их видит supabase-js.

export type ProfileRow = {
  id: string
  timezone: string
  day_capacity: number
  week_starts_on: number
  theme_mode: 'light' | 'dark' | 'system'
  theme_dark_id: string
  theme_light_id: string
  created_at: string
  updated_at: string
}

export type CategoryRow = {
  id: string
  user_id: string
  name: string
  icon: string
  sort_order: number
  archived_at: string | null
  updated_at: string
}

export type TagRow = {
  id: string
  user_id: string
  name: string
  updated_at: string
}

export type TaskTemplateRow = {
  id: string
  user_id: string
  title: string
  note: string | null
  importance: Importance
  urgency_manual: Urgency
  category_id: string | null
  due_time: TimeStr | null
  remind_before: number[]
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  step: number
  byweekday: number[] | null
  bymonthday: number | null
  starts_on: DateStr
  ends_mode: 'never' | 'on' | 'after'
  ends_on: DateStr | null
  ends_after: number | null
  materialized_through: DateStr | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type TaskRow = {
  id: string
  user_id: string
  title: string
  note: string | null
  importance: Importance
  urgency_manual: Urgency
  due_on: DateStr | null
  due_time: TimeStr | null
  remind_before: number[]
  scheduled_on: DateStr | null
  category_id: string | null
  template_id: string | null
  occurrence_on: DateStr | null
  order_index: number
  status: 'open' | 'done'
  completed_at: string | null
  urgency_at_completion: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TaskTagRow = {
  task_id: string
  tag_id: string
  user_id: string
}

export type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  device_label: string | null
  last_seen_at: string
  created_at: string
}
