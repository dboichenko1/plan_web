// Движок синхронизации (ТЗ §7). Отправка outbox строго по порядку, приём
// по updated_at с курсором в meta, Realtime-подписка на свои строки.
// Сервер — арбитр конфликтов; единственное исключение: строка с неотправленной
// записью в outbox не затирается приёмом, иначе набранное офлайн исчезнет.

import { useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import { db as productionDb } from './db'
import type { OutboxEntity, OutboxRow, PlannerDb } from './db'
import type {
  CategoryRow,
  ProfileRow,
  TagRow,
  TaskRow,
  TaskTagRow,
  TaskTemplateRow,
} from './contract'
import { supabase } from './supabase'
import { onSyncPoke } from './syncSignal'

export type SyncStatus = {
  state: 'idle' | 'pushing' | 'pulling' | 'offline' | 'error'
  pending: number
  failed: number
  lastPulledAt: string | null
}

const MAX_TRIES = 5
const PAGE = 1000

/** Таблицы с updated_at; task_tags без него — целиком при полном pull и по Realtime. */
const PULL_TABLES = ['profiles', 'categories', 'tags', 'task_templates', 'tasks'] as const

let activeDb: PlannerDb = productionDb
let activeClient: SupabaseClient | null = supabase

let running = false
let currentUserId: string | null = null
let pushing = false
let repush = false
let pulling = false
let retryTimer: ReturnType<typeof setTimeout> | null = null

let currentStatus: SyncStatus = { state: 'idle', pending: 0, failed: 0, lastPulledAt: null }
const statusListeners = new Set<(s: SyncStatus) => void>()

function metaKey(userId: string): string {
  return `last_pulled_at_${userId}`
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function emitStatus(next: SyncStatus): void {
  const c = currentStatus
  if (
    c.state === next.state &&
    c.pending === next.pending &&
    c.failed === next.failed &&
    c.lastPulledAt === next.lastPulledAt
  ) {
    return
  }
  currentStatus = next
  for (const l of statusListeners) l(next)
}

async function snapshot(): Promise<Omit<SyncStatus, 'state'>> {
  const rows = await activeDb.outbox.toArray()
  const failed = rows.filter((r) => r.tries >= MAX_TRIES).length
  const lastPulledAt = currentUserId
    ? ((await activeDb.meta.get(metaKey(currentUserId)))?.value ?? null)
    : null
  return { pending: rows.length - failed, failed, lastPulledAt }
}

async function refresh(state: SyncStatus['state']): Promise<void> {
  emitStatus({ state, ...(await snapshot()) })
}

export function onSyncStatus(cb: (s: SyncStatus) => void): () => void {
  statusListeners.add(cb)
  cb(currentStatus)
  return () => {
    statusListeners.delete(cb)
  }
}

/** Текущее состояние обмена для индикатора в интерфейсе. */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(currentStatus)
  useEffect(() => onSyncStatus(setStatus), [])
  return status
}

// --- Отправка -----------------------------------------------------------

async function sendRow(client: SupabaseClient, row: OutboxRow): Promise<string | null> {
  try {
    const res =
      row.op === 'upsert'
        ? await client.from(row.entity).upsert(row.payload)
        : // delete используется только для task_tags: ключи лежат в payload
          await client.from(row.entity).delete().match(row.payload)
    return res.error ? res.error.message : null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

/** Повтор с растущей задержкой: мин(2^tries, 60) секунд. */
function scheduleRetry(tries: number): void {
  if (!running || retryTimer !== null) return
  const delayMs = Math.min(2 ** tries, 60) * 1000
  retryTimer = setTimeout(() => {
    retryTimer = null
    void pushOutbox()
  }, delayMs)
}

export async function pushOutbox(): Promise<void> {
  const client = activeClient
  if (!client) {
    await refresh('idle')
    return
  }
  if (isOffline()) {
    await refresh('offline')
    return
  }
  if (pushing) {
    // толчок во время отправки: повторим заход после текущего
    repush = true
    return
  }
  pushing = true
  await refresh('pushing')
  let blocked = false
  try {
    const rows = (await activeDb.outbox.toArray()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    for (const row of rows) {
      if (row.tries >= MAX_TRIES) continue // помечена как failed — не блокирует остальные
      const error = await sendRow(client, row)
      if (error === null) {
        await activeDb.outbox.delete(row.id as number)
        continue
      }
      const tries = row.tries + 1
      await activeDb.outbox.update(row.id as number, { tries, last_error: error })
      if (tries < MAX_TRIES) {
        // порядок важен: следующие записи в этом заходе не отправляем
        blocked = true
        scheduleRetry(tries)
        break
      }
    }
  } finally {
    pushing = false
  }
  const snap = await snapshot()
  emitStatus({ state: blocked || snap.failed > 0 ? 'error' : 'idle', ...snap })
  if (repush) {
    repush = false
    void pushOutbox()
  }
}

// --- Приём --------------------------------------------------------------

/**
 * Ключи неотправленных правок: '<entity>:<entity_id>'. Для task_tags
 * entity_id — 'task_id:tag_id' (композитный ключ), repo обязан класть так же.
 */
async function pendingOutboxKeys(): Promise<Set<string>> {
  const rows = await activeDb.outbox.toArray()
  return new Set(rows.map((r) => `${r.entity}:${r.entity_id}`))
}

function pendingKey(entity: OutboxEntity, row: Record<string, unknown>): string {
  const id = entity === 'task_tags' ? `${row['task_id']}:${row['tag_id']}` : String(row['id'])
  return `${entity}:${id}`
}

async function applyServerRow(
  entity: OutboxEntity,
  row: Record<string, unknown>,
  pending: Set<string>,
): Promise<void> {
  if (pending.has(pendingKey(entity, row))) return // локальная версия побеждает до отправки
  switch (entity) {
    case 'profiles':
      await activeDb.profiles.put(row as unknown as ProfileRow)
      break
    case 'categories':
      await activeDb.categories.put(row as unknown as CategoryRow)
      break
    case 'tags':
      await activeDb.tags.put(row as unknown as TagRow)
      break
    case 'task_templates':
      await activeDb.task_templates.put(row as unknown as TaskTemplateRow)
      break
    case 'tasks':
      await activeDb.tasks.put(row as unknown as TaskRow)
      break
    case 'task_tags':
      await activeDb.task_tags.put(row as unknown as TaskTagRow)
      break
  }
}

/** Полная замена task_tags серверным набором; неотправленные локальные — выживают. */
async function applyTaskTagsFull(rows: TaskTagRow[], pending: Set<string>): Promise<void> {
  await activeDb.transaction('rw', activeDb.task_tags, async () => {
    const local = await activeDb.task_tags.toArray()
    const keep = local.filter((r) => pending.has(`task_tags:${r.task_id}:${r.tag_id}`))
    const fresh = rows.filter((r) => !pending.has(`task_tags:${r.task_id}:${r.tag_id}`))
    await activeDb.task_tags.clear()
    await activeDb.task_tags.bulkPut([...fresh, ...keep])
  })
}

export async function pullSince(userId: string): Promise<void> {
  const client = activeClient
  if (!client) return
  currentUserId = userId
  if (isOffline()) {
    await refresh('offline')
    return
  }
  if (pulling) return
  pulling = true
  await refresh('pulling')
  let ok = false
  try {
    const key = metaKey(userId)
    const last = (await activeDb.meta.get(key))?.value ?? null
    let maxUpdated: string | null = last
    const pending = await pendingOutboxKeys()

    for (const table of PULL_TABLES) {
      let offset = 0
      for (;;) {
        let q = client.from(table).select('*')
        if (last !== null) q = q.gt('updated_at', last)
        const { data, error } = await q
          .order('updated_at', { ascending: true })
          .range(offset, offset + PAGE - 1)
        if (error) throw new Error(error.message)
        const rows = (data ?? []) as Record<string, unknown>[]
        for (const row of rows) {
          const u = row['updated_at']
          if (typeof u === 'string' && (maxUpdated === null || u > maxUpdated)) maxUpdated = u
          await applyServerRow(table, row, pending)
        }
        if (rows.length < PAGE) break
        offset += PAGE
      }
    }

    // task_tags без updated_at: целиком при первом pull, дальше догоняет Realtime
    if (last === null) {
      const { data, error } = await client.from('task_tags').select('*')
      if (error) throw new Error(error.message)
      await applyTaskTagsFull((data ?? []) as TaskTagRow[], pending)
    }

    // курсор — max(updated_at) серверных строк: серверное время, не клиентское
    if (maxUpdated !== null && maxUpdated !== last) {
      await activeDb.meta.put({ key, value: maxUpdated })
    }
    ok = true
  } catch {
    // статус выставим ниже; повтор случится по следующему триггеру
  } finally {
    pulling = false
  }
  await refresh(ok ? 'idle' : 'error')
  if (ok && running) void pushOutbox() // отправка после приёма — один из триггеров
}

// --- Realtime и запуск ----------------------------------------------------

async function deleteLocal(entity: OutboxEntity, old: Record<string, unknown>): Promise<void> {
  if (entity === 'task_tags') {
    const taskId = old['task_id']
    const tagId = old['tag_id']
    if (typeof taskId === 'string' && typeof tagId === 'string') {
      await activeDb.task_tags.delete([taskId, tagId])
    }
    return
  }
  const id = old['id']
  if (typeof id !== 'string') return
  switch (entity) {
    case 'profiles':
      await activeDb.profiles.delete(id)
      break
    case 'categories':
      await activeDb.categories.delete(id)
      break
    case 'tags':
      await activeDb.tags.delete(id)
      break
    case 'task_templates':
      await activeDb.task_templates.delete(id)
      break
    case 'tasks':
      await activeDb.tasks.delete(id)
      break
  }
}

async function handleRealtime(
  entity: OutboxEntity,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  userId: string,
): Promise<void> {
  if (payload.eventType === 'DELETE') {
    await deleteLocal(entity, payload.old as Record<string, unknown>)
  } else {
    const pending = await pendingOutboxKeys()
    await applyServerRow(entity, payload.new as Record<string, unknown>, pending)
  }
  void pullSince(userId) // дёшево догоняет хвост, если событий пришла пачка
}

/** Запуск обмена: подписки, Realtime и первый pull. Возвращает остановку. */
export function startSync(userId: string): () => void {
  const client = activeClient
  if (!client) {
    // демо-режим без Supabase: счётчики outbox всё равно показываем
    void refresh('idle')
    return () => {}
  }
  running = true
  currentUserId = userId

  const offPoke = onSyncPoke(() => {
    void pushOutbox()
  })
  const onOnline = () => {
    void pushOutbox()
  }
  const onVisible = () => {
    // возврат из фона: приём, после него отправка
    if (document.visibilityState === 'visible') void pullSince(userId)
  }
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline)
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)

  const channel = client.channel(`planner-sync-${userId}`)
  // у profiles нет user_id — ключ и есть id пользователя
  const filters: Array<{ table: OutboxEntity; filter: string }> = [
    { table: 'profiles', filter: `id=eq.${userId}` },
    { table: 'categories', filter: `user_id=eq.${userId}` },
    { table: 'tags', filter: `user_id=eq.${userId}` },
    { table: 'task_templates', filter: `user_id=eq.${userId}` },
    { table: 'tasks', filter: `user_id=eq.${userId}` },
    { table: 'task_tags', filter: `user_id=eq.${userId}` },
  ]
  for (const f of filters) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: f.table, filter: f.filter },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        void handleRealtime(f.table, payload, userId)
      },
    )
  }
  channel.subscribe()

  void pullSince(userId)

  return () => {
    running = false
    offPoke()
    if (typeof window !== 'undefined') window.removeEventListener('online', onOnline)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    void client.removeChannel(channel)
  }
}

// --- Тестовая обвязка -----------------------------------------------------

/** Внедрение зависимостей для тестов. Продакшен-код это не зовёт. */
export function _configureForTests(opts: { db?: PlannerDb; client?: SupabaseClient | null }): void {
  if (opts.db) activeDb = opts.db
  if ('client' in opts) activeClient = opts.client ?? null
  running = false
  currentUserId = null
  pushing = false
  repush = false
  pulling = false
  if (retryTimer !== null) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  currentStatus = { state: 'idle', pending: 0, failed: 0, lastPulledAt: null }
}
