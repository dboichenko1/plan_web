import { describe, expect, it } from 'vitest'
import { daysHanging, taskState } from './state'
import type { TaskLike } from './types'

const TODAY = '2026-08-01'
const YESTERDAY = '2026-07-31'
const WEEK_AGO = '2026-07-25'
const TOMORROW = '2026-08-02'

function task(overrides: Partial<TaskLike> = {}): TaskLike {
  return { status: 'open', importance: 2, urgency_manual: 2, ...overrides }
}

describe('taskState', () => {
  it('без дат открытая задача — live', () => {
    expect(taskState(task(), TODAY)).toBe('live')
  })

  it('status done — done', () => {
    expect(taskState(task({ status: 'done' }), TODAY)).toBe('done')
  })

  it('due_on в прошлом — expired', () => {
    expect(taskState(task({ due_on: YESTERDAY }), TODAY)).toBe('expired')
  })

  it('scheduled_on в прошлом без due_on — slipped', () => {
    expect(taskState(task({ scheduled_on: YESTERDAY }), TODAY)).toBe('slipped')
  })

  it('done перекрывает всё: выполненная задача с обеими датами в прошлом — done', () => {
    expect(
      taskState(task({ status: 'done', due_on: WEEK_AGO, scheduled_on: YESTERDAY }), TODAY),
    ).toBe('done')
  })

  it('expired перекрывает slipped: обе даты в прошлом — expired', () => {
    expect(taskState(task({ due_on: WEEK_AGO, scheduled_on: YESTERDAY }), TODAY)).toBe('expired')
  })

  it('due_on === today — live: срок сегодня не сгорел', () => {
    expect(taskState(task({ due_on: TODAY }), TODAY)).toBe('live')
  })

  it('scheduled_on === today — live', () => {
    expect(taskState(task({ scheduled_on: TODAY }), TODAY)).toBe('live')
  })

  it('due_on в прошлом, scheduled_on сегодня — expired', () => {
    expect(taskState(task({ due_on: YESTERDAY, scheduled_on: TODAY }), TODAY)).toBe('expired')
  })

  it('due_on в будущем не мешает slipped по scheduled_on', () => {
    expect(taskState(task({ due_on: TOMORROW, scheduled_on: YESTERDAY }), TODAY)).toBe('slipped')
  })

  it('обе даты в будущем — live', () => {
    expect(taskState(task({ due_on: TOMORROW, scheduled_on: TOMORROW }), TODAY)).toBe('live')
  })

  it('null-даты равносильны отсутствию', () => {
    expect(taskState(task({ due_on: null, scheduled_on: null }), TODAY)).toBe('live')
    expect(taskState(task({ due_on: null, scheduled_on: YESTERDAY }), TODAY)).toBe('slipped')
  })
})

describe('daysHanging', () => {
  it('0, когда нет ни одной даты', () => {
    expect(daysHanging(task(), TODAY)).toBe(0)
    expect(daysHanging(task({ due_on: null, scheduled_on: null }), TODAY)).toBe(0)
  })

  it('считается от due_on, когда тот в прошлом', () => {
    expect(daysHanging(task({ due_on: WEEK_AGO }), TODAY)).toBe(7)
  })

  it('due_on в прошлом, scheduled_on позже него — всё равно от due_on', () => {
    expect(daysHanging(task({ due_on: WEEK_AGO, scheduled_on: YESTERDAY }), TODAY)).toBe(7)
  })

  it('due_on сегодня не считается прошедшим — берётся scheduled_on', () => {
    expect(daysHanging(task({ due_on: TODAY, scheduled_on: WEEK_AGO }), TODAY)).toBe(7)
  })

  it('due_on в будущем — берётся scheduled_on', () => {
    expect(daysHanging(task({ due_on: TOMORROW, scheduled_on: YESTERDAY }), TODAY)).toBe(1)
  })

  it('ноль для задачи, назначенной на сегодня', () => {
    expect(daysHanging(task({ scheduled_on: TODAY }), TODAY)).toBe(0)
  })

  it('0, когда due_on сегодня, а scheduled_on нет', () => {
    expect(daysHanging(task({ due_on: TODAY }), TODAY)).toBe(0)
  })

  it('due_on null — берётся scheduled_on', () => {
    expect(daysHanging(task({ due_on: null, scheduled_on: YESTERDAY }), TODAY)).toBe(1)
  })
})
