// Фильтр списков: каждая ось, схлопывание expired→slipped, три сортировки.

import { describe, expect, it } from 'vitest'
import type { TaskRow } from './contract'
import { EMPTY_FILTER, applyFilter, countMatches, isEmptyFilter, type TaskFilter } from './filters'

const TODAY = '2026-08-01'

let seq = 0
function task(over: Partial<TaskRow> = {}): TaskRow {
  seq += 1
  return {
    id: `t${seq}`,
    user_id: 'u1',
    title: 'Задача',
    note: null,
    importance: 2,
    urgency_manual: 1,
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
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    deleted_at: null,
    ...over,
  }
}

function filter(over: Partial<TaskFilter>): TaskFilter {
  return { ...EMPTY_FILTER, ...over }
}

const NO_TAGS = new Map<string, string[]>()

describe('isEmptyFilter', () => {
  it('пустой фильтр с естественной сортировкой — пустой', () => {
    expect(isEmptyFilter(EMPTY_FILTER)).toBe(true)
  })

  it('нестандартная сортировка делает фильтр непустым', () => {
    expect(isEmptyFilter(filter({ sort: 'due' }))).toBe(false)
    expect(isEmptyFilter(filter({ states: ['live'] }))).toBe(false)
  })
})

describe('applyFilter — оси', () => {
  it('пустой фильтр пропускает всё, кроме мягко удалённого', () => {
    const alive = task()
    const deleted = task({ deleted_at: '2026-07-30T10:00:00Z' })
    expect(applyFilter([alive, deleted], EMPTY_FILTER, TODAY, NO_TAGS)).toEqual([alive])
  })

  it('категории: задача без категории не проходит фильтр по категории', () => {
    const home = task({ category_id: 'cat-home' })
    const bare = task({ category_id: null })
    const work = task({ category_id: 'cat-work' })
    const got = applyFilter([home, bare, work], filter({ categories: ['cat-home'] }), TODAY, NO_TAGS)
    expect(got).toEqual([home])
  })

  it('теги: достаточно любого из выбранных', () => {
    const a = task()
    const b = task()
    const c = task()
    const taskTags = new Map([
      [a.id, ['tag-1']],
      [b.id, ['tag-2', 'tag-3']],
    ])
    const got = applyFilter([a, b, c], filter({ tags: ['tag-1', 'tag-3'] }), TODAY, taskTags)
    expect(got.map((t) => t.id)).toEqual([a.id, b.id])
  })

  it('срочность считается эффективной: срок сегодня — это «горит»', () => {
    const burning = task({ due_on: TODAY, urgency_manual: 1 })
    const someday = task({ urgency_manual: 1 })
    const got = applyFilter([burning, someday], filter({ urgency: [4] }), TODAY, NO_TAGS)
    expect(got).toEqual([burning])
  })

  it('важность: мультивыбор', () => {
    const small = task({ importance: 1 })
    const normal = task({ importance: 2 })
    const key = task({ importance: 4 })
    const got = applyFilter([small, normal, key], filter({ importance: [1, 4] }), TODAY, NO_TAGS)
    expect(got.map((t) => t.id)).toEqual([key.id, small.id]) // естественная: важные выше
  })

  it('состояния: expired считается слетевшей', () => {
    const live = task({ scheduled_on: TODAY })
    const slipped = task({ scheduled_on: '2026-07-28' })
    const expired = task({ due_on: '2026-07-25' })
    const done = task({ status: 'done', completed_at: '2026-07-31T10:00:00Z' })
    const all = [live, slipped, expired, done]
    const gotSlipped = applyFilter(all, filter({ states: ['slipped'], sort: 'created' }), TODAY, NO_TAGS)
    expect(new Set(gotSlipped.map((t) => t.id))).toEqual(new Set([slipped.id, expired.id]))
    const gotDone = applyFilter(all, filter({ states: ['done'] }), TODAY, NO_TAGS)
    expect(gotDone).toEqual([done])
  })
})

describe('applyFilter — сортировка', () => {
  it('естественная: по убыванию срочности, внутри — важности, устойчиво', () => {
    const a = task({ importance: 1, urgency_manual: 2 })
    const b = task({ importance: 3, urgency_manual: 2 })
    const c = task({ importance: 3, due_on: TODAY }) // эффективная срочность 4
    const d = task({ importance: 1, urgency_manual: 2 }) // равен a — остаётся после него
    const got = applyFilter([a, b, c, d], EMPTY_FILTER, TODAY, NO_TAGS)
    expect(got.map((t) => t.id)).toEqual([c.id, b.id, a.id, d.id])
  })

  it('по сроку: раньше — выше, без срока — в конце, без времени — после времени', () => {
    const noDue = task()
    const late = task({ due_on: '2026-08-10' })
    const earlyNoTime = task({ due_on: '2026-08-03' })
    const earlyTimed = task({ due_on: '2026-08-03', due_time: '09:00' })
    const got = applyFilter([noDue, late, earlyNoTime, earlyTimed], filter({ sort: 'due' }), TODAY, NO_TAGS)
    expect(got.map((t) => t.id)).toEqual([earlyTimed.id, earlyNoTime.id, late.id, noDue.id])
  })

  it('по созданию: новые сверху', () => {
    const old = task({ created_at: '2026-06-01T00:00:00Z' })
    const fresh = task({ created_at: '2026-07-31T12:00:00Z' })
    const got = applyFilter([old, fresh], filter({ sort: 'created' }), TODAY, NO_TAGS)
    expect(got.map((t) => t.id)).toEqual([fresh.id, old.id])
  })
})

describe('countMatches', () => {
  it('совпадает с длиной applyFilter', () => {
    const tasks = [task({ importance: 4 }), task(), task({ deleted_at: '2026-07-30T00:00:00Z' })]
    const f = filter({ importance: [4] })
    expect(countMatches(tasks, f, TODAY, NO_TAGS)).toBe(1)
    expect(countMatches(tasks, EMPTY_FILTER, TODAY, NO_TAGS)).toBe(2)
  })
})
