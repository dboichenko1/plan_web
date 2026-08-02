// Локальное зеркало таблиц + outbox. UI читает и пишет только сюда;
// сеть догоняет в фоне. Сервер — источник истины, эта база — кеш.

import Dexie, { type Table } from 'dexie'
import type {
  CategoryRow,
  ProfileRow,
  PushSubscriptionRow,
  TagRow,
  TaskRow,
  TaskTagRow,
  TaskTemplateRow,
} from './contract'

export type OutboxEntity =
  | 'profiles'
  | 'categories'
  | 'tags'
  | 'task_templates'
  | 'tasks'
  | 'task_tags'
  | 'push_subscriptions'

export type OutboxRow = {
  id?: number
  entity: OutboxEntity
  entity_id: string
  op: 'upsert' | 'delete'
  payload: Record<string, unknown>
  created_at: string
  tries: number
  last_error?: string
}

export type MetaRow = { key: string; value: string }

export class PlannerDb extends Dexie {
  profiles!: Table<ProfileRow, string>
  categories!: Table<CategoryRow, string>
  tags!: Table<TagRow, string>
  task_templates!: Table<TaskTemplateRow, string>
  tasks!: Table<TaskRow, string>
  task_tags!: Table<TaskTagRow, [string, string]>
  push_subscriptions!: Table<PushSubscriptionRow, string>
  outbox!: Table<OutboxRow, number>
  meta!: Table<MetaRow, string>

  constructor(name = 'planner') {
    super(name)
    this.version(1).stores({
      profiles: 'id',
      categories: 'id, sort_order',
      tags: 'id, name',
      task_templates: 'id, archived_at',
      tasks: 'id, scheduled_on, due_on, status, template_id, updated_at',
      task_tags: '[task_id+tag_id], task_id, tag_id',
      outbox: '++id, created_at',
      meta: 'key',
    })
    // Подписки на пуши (фаза 9): endpoint индексируется, чтобы повторная
    // подписка того же устройства не плодила строк.
    this.version(2).stores({
      push_subscriptions: 'id, endpoint',
    })
  }
}

export const db = new PlannerDb()

/**
 * Просим браузер не выселять IndexedDB: в кеше лежит и outbox
 * с несинхронизированными офлайн-правками. Сервер всё равно источник истины.
 */
export function requestPersistentStorage(): void {
  void navigator.storage?.persist?.()
}
