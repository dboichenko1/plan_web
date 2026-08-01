// Шаблоны повторов поверх Dexie на fake-indexeddb: материализация окна +60,
// идемпотентность, «эту и все следующие», мягкое удаление шаблона.

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import type { Rule } from '../domain/recurrence'
import {
  createTemplate,
  deleteTemplate,
  describeRule,
  editThisAndFollowing,
  materializeTemplate,
} from './templates'
import { completeTask } from './repo'

// 2026-08-01 — суббота; окно материализации: по 2026-09-30 включительно.
const TODAY = '2026-08-01'
const USER = 'user-1'

// «Мусор по вт и пт»: вторники и пятницы с 2026-08-01 по 2026-09-30 —
// 9 вторников (4.08…29.09) и 8 пятниц (7.08…25.09), всего 17.
const trashRule: Rule = {
  freq: 'weekly',
  step: 1,
  byweekday: [2, 5],
  starts_on: TODAY,
  ends: { mode: 'never' },
}

async function createTrashTemplate() {
  await createTemplate(
    { title: 'Вынести мусор', importance: 1, urgency_manual: 2, rule: trashRule },
    USER,
    TODAY,
  )
  const tpl = (await db.task_templates.toArray())[0]
  if (!tpl) throw new Error('шаблон не создан')
  return tpl
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('createTemplate + materializeTemplate', () => {
  it('материализует экземпляры на 60 дней вперёд', async () => {
    const tpl = await createTrashTemplate()
    expect(tpl.freq).toBe('weekly')
    expect(tpl.byweekday).toEqual([2, 5])
    expect(tpl.materialized_through).toBe('2026-09-30')

    const instances = await db.tasks.where('template_id').equals(tpl.id).toArray()
    expect(instances).toHaveLength(17)
    for (const t of instances) {
      expect(t.scheduled_on).toBe(t.occurrence_on)
      expect(t.due_on).toBeNull()
      expect(t.title).toBe('Вынести мусор')
      expect(t.status).toBe('open')
    }
    const dates = instances.map((t) => t.occurrence_on).sort()
    expect(dates[0]).toBe('2026-08-04')
    expect(dates[16]).toBe('2026-09-29')
  })

  it('повторный вызов не дублирует экземпляры', async () => {
    const tpl = await createTrashTemplate()
    await materializeTemplate(tpl.id, TODAY)
    // И при сброшенном materialized_through дубли не появляются: пары
    // (template_id, occurrence_on) проверяются по Dexie.
    await db.task_templates.update(tpl.id, { materialized_through: null })
    await materializeTemplate(tpl.id, TODAY)
    const instances = await db.tasks.where('template_id').equals(tpl.id).toArray()
    expect(instances).toHaveLength(17)
  })
})

describe('editThisAndFollowing', () => {
  it('режет старый шаблон накануне и создаёт новый', async () => {
    const tpl = await createTrashTemplate()
    const instances = await db.tasks.where('template_id').equals(tpl.id).toArray()
    const picked = instances.find((t) => t.occurrence_on === '2026-09-01')
    const done = instances.find((t) => t.occurrence_on === '2026-09-04')
    if (!picked || !done) throw new Error('нет ожидаемых экземпляров')
    // Выполненный будущий экземпляр — история, его трогать нельзя.
    await completeTask(done.id, TODAY)

    await editThisAndFollowing(
      picked.id,
      {
        title: 'Вынести мусор и стекло',
        importance: 1,
        urgency_manual: 2,
        rule: { ...trashRule, starts_on: '2026-09-01' },
      },
      TODAY,
    )

    const oldTpl = await db.task_templates.get(tpl.id)
    expect(oldTpl?.ends_mode).toBe('on')
    expect(oldTpl?.ends_on).toBe('2026-08-31')

    const oldInstances = await db.tasks.where('template_id').equals(tpl.id).toArray()
    for (const t of oldInstances) {
      if (t.id === done.id) {
        expect(t.deleted_at).toBeNull()
        expect(t.status).toBe('done')
      } else if (t.occurrence_on && t.occurrence_on >= '2026-09-01') {
        expect(t.deleted_at).not.toBeNull()
      } else {
        expect(t.deleted_at).toBeNull()
      }
    }

    const newTpl = (await db.task_templates.toArray()).find((t) => t.id !== tpl.id)
    if (!newTpl) throw new Error('новый шаблон не создан')
    expect(newTpl.title).toBe('Вынести мусор и стекло')
    expect(newTpl.starts_on).toBe('2026-09-01')
    // Вт и пт с 1.09 по 30.09: 5 вторников + 4 пятницы.
    const newInstances = await db.tasks.where('template_id').equals(newTpl.id).toArray()
    expect(newInstances).toHaveLength(9)
    expect(newInstances.every((t) => t.title === 'Вынести мусор и стекло')).toBe(true)
  })
})

describe('deleteTemplate', () => {
  it('архивирует шаблон и мягко удаляет невыполненные, не трогая выполненные', async () => {
    const tpl = await createTrashTemplate()
    const instances = await db.tasks.where('template_id').equals(tpl.id).toArray()
    const done = instances.find((t) => t.occurrence_on === '2026-08-04')
    if (!done) throw new Error('нет экземпляра на 4 августа')
    await completeTask(done.id, TODAY)

    await deleteTemplate(tpl.id)

    const archived = await db.task_templates.get(tpl.id)
    expect(archived?.archived_at).not.toBeNull()

    const after = await db.tasks.where('template_id').equals(tpl.id).toArray()
    for (const t of after) {
      if (t.id === done.id) {
        expect(t.status).toBe('done')
        expect(t.deleted_at).toBeNull()
      } else {
        expect(t.deleted_at).not.toBeNull()
      }
    }
  })
})

describe('describeRule', () => {
  it('описывает правило по-русски', () => {
    expect(describeRule(trashRule)).toBe('Каждую неделю по вт, пт')
    expect(
      describeRule({ freq: 'monthly', step: 2, bymonthday: 31, starts_on: TODAY, ends: { mode: 'never' } }),
    ).toBe('Каждые 2 месяца 31 числа')
    expect(
      describeRule({ freq: 'daily', step: 1, starts_on: TODAY, ends: { mode: 'on', on: '2026-12-31' } }),
    ).toBe('Каждый день · до 31.12')
    expect(
      describeRule({ freq: 'yearly', step: 1, starts_on: TODAY, ends: { mode: 'after', after: 5 } }),
    ).toBe('Каждый год · 5 раз')
  })
})
