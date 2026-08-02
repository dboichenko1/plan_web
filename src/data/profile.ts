// Настройки профиля и словари (категории, теги, подписки на пуши):
// та же схема, что в repo.ts — пишем в Dexie, кладём в outbox, UI обновляется
// сразу, сеть догоняет в фоне.

import { db, type OutboxEntity } from './db'
import type { CategoryRow, ProfileRow } from './contract'
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

/** В outbox — вся строка без created_at/updated_at: их ставит сервер (как в repo.ts). */
export async function updateProfile(userId: string, patch: Partial<ProfileRow>): Promise<void> {
  await db.profiles.update(userId, { ...patch, updated_at: nowIso() })
  const row = await db.profiles.get(userId)
  if (!row) return // профиль ещё не приехал — обновлять нечего
  const { created_at, updated_at, ...payload } = row
  void created_at
  void updated_at
  await enqueue('profiles', userId, payload)
}

/** Переименование и архив категорий. Отдельная таблица — updateProfile не подходит. */
export async function updateCategory(
  userId: string,
  id: string,
  patch: Partial<CategoryRow>,
): Promise<void> {
  await db.categories.update(id, { ...patch, updated_at: nowIso() })
  const row = await db.categories.get(id)
  if (!row || row.user_id !== userId) return
  const { updated_at, ...payload } = row
  void updated_at
  await enqueue('categories', id, payload)
}

/**
 * Удаление тега — жёсткое: у tags нет deleted_at, строка уходит с сервера
 * насовсем. Сначала связи task_tags (op delete, ключи в payload — их же ждёт
 * sendRow в sync.ts), затем сам тег.
 */
export async function deleteTag(userId: string, id: string): Promise<void> {
  const links = await db.task_tags.where('tag_id').equals(id).toArray()
  for (const link of links) {
    await db.task_tags.delete([link.task_id, link.tag_id])
    await enqueue(
      'task_tags',
      `${link.task_id}:${link.tag_id}`,
      { task_id: link.task_id, tag_id: link.tag_id, user_id: userId },
      'delete',
    )
  }
  await db.tags.delete(id)
  await enqueue('tags', id, { id, user_id: userId }, 'delete')
}

/** Отключение устройства от пушей: подписка удаляется жёстко, как тег. */
export async function deletePushSubscription(userId: string, id: string): Promise<void> {
  await db.push_subscriptions.delete(id)
  await enqueue('push_subscriptions', id, { id, user_id: userId }, 'delete')
}

/** Все таблицы пользователя из Dexie одним JSON — для выгрузки в файл. */
export async function exportJson(userId: string): Promise<Blob> {
  const [profile, categories, tags, tasks, task_templates, task_tags] = await Promise.all([
    db.profiles.get(userId),
    db.categories.filter((r) => r.user_id === userId).toArray(),
    db.tags.filter((r) => r.user_id === userId).toArray(),
    db.tasks.filter((r) => r.user_id === userId).toArray(),
    db.task_templates.filter((r) => r.user_id === userId).toArray(),
    db.task_tags.filter((r) => r.user_id === userId).toArray(),
  ])
  const data = {
    profiles: profile ? [profile] : [],
    categories,
    tags,
    tasks,
    task_templates,
    task_tags,
  }
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}
