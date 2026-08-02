// Тесты движка синхронизации: офлайн-мутация, отправка, приём.
// Dexie в node живёт на fake-indexeddb; Supabase — минимальный стаб.

import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PlannerDb, db } from './db'
import type { TaskRow } from './contract'
import { createTask } from './repo'
import { _configureForTests, pullSince, pushOutbox } from './sync'

const NOW = '2026-08-01T10:00:00.000Z'
const TODAY = '2026-08-01'

type Call = { entity: string; op: 'upsert' | 'delete'; payload: Record<string, unknown> }

/** Стаб supabase-js: пишет вызовы в calls, отдаёт rows на select. */
function makeClient(
  opts: {
    tables?: Record<string, Record<string, unknown>[]>
    upsertError?: (entity: string, payload: Record<string, unknown>) => string | null
  } = {},
) {
  const calls: Call[] = []
  const client = {
    from(entity: string) {
      const rows = opts.tables?.[entity] ?? []
      return {
        upsert(payload: Record<string, unknown>) {
          calls.push({ entity, op: 'upsert', payload })
          const msg = opts.upsertError?.(entity, payload) ?? null
          return Promise.resolve({ error: msg ? { message: msg } : null })
        },
        delete() {
          return {
            match(keys: Record<string, unknown>) {
              calls.push({ entity, op: 'delete', payload: keys })
              return Promise.resolve({ error: null })
            },
          }
        },
        select(_cols: string) {
          let gt: string | null = null
          const builder = {
            gt(_col: string, value: string) {
              gt = value
              return builder
            },
            order(_col: string, _opts?: unknown) {
              return builder
            },
            range(from: number, to: number) {
              const filtered = gt === null ? rows : rows.filter((r) => String(r['updated_at']) > gt!)
              const sorted = [...filtered].sort((a, b) =>
                String(a['updated_at']).localeCompare(String(b['updated_at'])),
              )
              return Promise.resolve({ data: sorted.slice(from, to + 1), error: null })
            },
            // сам builder — thenable: `await select('*')` без range (task_tags)
            then(resolve: (v: { data: unknown[]; error: null }) => void) {
              resolve({ data: rows, error: null })
            },
          }
          return builder
        },
      }
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

function outboxRow(
  entity: 'tasks' | 'categories' | 'task_tags',
  entityId: string,
  payload: Record<string, unknown>,
  op: 'upsert' | 'delete' = 'upsert',
) {
  return { entity, entity_id: entityId, op, payload, created_at: NOW, tries: 0 }
}

function taskRow(id: string, title: string, updatedAt = NOW): TaskRow {
  return {
    id,
    user_id: 'u1',
    title,
    note: null,
    importance: 2,
    urgency_manual: 2,
    due_on: null,
    due_time: null,
    remind_before: [],
    scheduled_on: null,
    category_id: null,
    template_id: null,
    occurrence_on: null,
    order_index: 0,
    status: 'open',
    completed_at: null,
    urgency_at_completion: null,
    created_at: NOW,
    updated_at: updatedAt,
    deleted_at: null,
  }
}

describe('sync', () => {
  it('офлайн-мутация складывается в outbox', async () => {
    await db.outbox.clear()
    const task = await createTask(
      { user_id: 'u1', title: 'Купить хлеб', importance: 2, urgency_manual: 2 },
      TODAY,
    )
    const rows = await db.outbox.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.entity).toBe('tasks')
    expect(rows[0]!.entity_id).toBe(task.id)
    expect(rows[0]!.op).toBe('upsert')
    expect((rows[0]!.payload as Record<string, unknown>)['title']).toBe('Купить хлеб')
  })

  it('pushOutbox удаляет запись после успешного upsert и шлёт по порядку', async () => {
    const tdb = new PlannerDb('test-push-order')
    const { client, calls } = makeClient()
    _configureForTests({ db: tdb, client })

    await tdb.outbox.add(outboxRow('categories', 'c1', { id: 'c1', name: 'Дом' }))
    await tdb.outbox.add(outboxRow('tasks', 't1', { id: 't1', title: 'A' }))
    await tdb.outbox.add(
      outboxRow('task_tags', 't1:g1', { task_id: 't1', tag_id: 'g1', user_id: 'u1' }, 'delete'),
    )

    await pushOutbox()

    expect(await tdb.outbox.count()).toBe(0)
    expect(calls.map((c) => `${c.op}:${c.entity}`)).toEqual([
      'upsert:categories',
      'upsert:tasks',
      'delete:task_tags',
    ])
    // delete ушёл match-ем по ключам payload
    expect(calls[2]!.payload).toEqual({ task_id: 't1', tag_id: 'g1', user_id: 'u1' })
  })

  it('ошибка: tries растёт, следующая запись не отправляется', async () => {
    const tdb = new PlannerDb('test-push-error')
    const { client, calls } = makeClient({
      upsertError: (_entity, payload) => (payload['id'] === 'bad' ? 'boom' : null),
    })
    _configureForTests({ db: tdb, client })

    await tdb.outbox.add(outboxRow('tasks', 'bad', { id: 'bad', title: 'Сломанная' }))
    await tdb.outbox.add(outboxRow('tasks', 'ok', { id: 'ok', title: 'Целая' }))

    await pushOutbox()

    const rows = (await tdb.outbox.toArray()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    expect(rows).toHaveLength(2)
    expect(rows[0]!.tries).toBe(1)
    expect(rows[0]!.last_error).toBe('boom')
    expect(rows[1]!.tries).toBe(0) // порядок важен: вторая не пыталась
    expect(calls).toHaveLength(1)

    // повторный заход: tries растёт дальше, вторая всё ещё ждёт
    await pushOutbox()
    const again = (await tdb.outbox.toArray()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    expect(again[0]!.tries).toBe(2)
    expect(again[1]!.tries).toBe(0)
    expect(calls).toHaveLength(2)
  })

  it('pull не затирает строку с неотправленным outbox, затирает без него', async () => {
    const tdb = new PlannerDb('test-pull-conflict')
    await tdb.tasks.put(taskRow('t1', 'локальная правка'))
    await tdb.tasks.put(taskRow('t2', 'локальная старая'))
    // у t1 есть неотправленная правка — локальная версия побеждает
    await tdb.outbox.add(outboxRow('tasks', 't1', { id: 't1', title: 'локальная правка' }))

    const { client } = makeClient({
      tables: {
        tasks: [
          taskRow('t1', 'серверная', '2026-08-01T11:00:00.000Z') as unknown as Record<string, unknown>,
          taskRow('t2', 'серверная новая', '2026-08-01T12:00:00.000Z') as unknown as Record<string, unknown>,
        ],
      },
    })
    _configureForTests({ db: tdb, client })

    await pullSince('u1')

    expect((await tdb.tasks.get('t1'))!.title).toBe('локальная правка')
    expect((await tdb.tasks.get('t2'))!.title).toBe('серверная новая')
  })

  it('last_pulled_at двигается по max(updated_at)', async () => {
    const tdb = new PlannerDb('test-pull-last')
    const tasks: Record<string, unknown>[] = [
      taskRow('x1', 'X1', '2026-08-01T09:00:00.000Z') as unknown as Record<string, unknown>,
    ]
    const categories: Record<string, unknown>[] = [
      { id: 'c1', user_id: 'u9', name: 'Дом', updated_at: '2026-08-02T07:00:00.000Z' },
    ]
    const { client } = makeClient({ tables: { tasks, categories } })
    _configureForTests({ db: tdb, client })

    await pullSince('u9')
    expect((await tdb.meta.get('last_pulled_at_u9'))?.value).toBe('2026-08-02T07:00:00.000Z')

    // новая серверная строка двигает курсор дальше; старые отфильтрованы по gt
    tasks.push(taskRow('x2', 'X2', '2026-08-03T05:00:00.000Z') as unknown as Record<string, unknown>)
    await pullSince('u9')
    expect((await tdb.meta.get('last_pulled_at_u9'))?.value).toBe('2026-08-03T05:00:00.000Z')
    expect((await tdb.tasks.get('x2'))!.title).toBe('X2')
  })
})
