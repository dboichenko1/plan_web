// Демо-набор для разработки без Supabase (VITE_DEMO=1): наполненный день,
// висящие задачи и инбокс.

import { db } from './db'
import type { CategoryRow, TaskRow } from './contract'
import { DEMO_USER_ID } from '../app/session'
import { addDays } from '../domain/date'
import type { DateStr, Importance, Urgency } from '../domain/types'

const CATEGORIES: [string, string][] = [
  ['Дом', 'home'],
  ['Работа', 'work'],
  ['Здоровье', 'health'],
  ['Деньги', 'money'],
  ['Учёба', 'study'],
  ['Люди', 'people'],
  ['Быт', 'chores'],
]

export async function seedDemo(today: DateStr): Promise<void> {
  const count = await db.tasks.count()
  if (count > 0) return

  const ts = new Date().toISOString()
  const cats: CategoryRow[] = CATEGORIES.map(([name, icon], i) => ({
    id: `cat-${icon}`,
    user_id: DEMO_USER_ID,
    name,
    icon,
    sort_order: i + 1,
    archived_at: null,
    updated_at: ts,
  }))
  await db.categories.bulkPut(cats)
  await db.profiles.put({
    id: DEMO_USER_ID,
    timezone: 'Europe/Warsaw',
    day_capacity: 32,
    week_starts_on: 1,
    theme_mode: 'system',
    theme_dark_id: 'graphite',
    theme_light_id: 'paper',
    created_at: ts,
    updated_at: ts,
  })

  // id детерминированные: StrictMode запускает эффект дважды, bulkPut делает
  // повторный засев идемпотентным.
  let order = 0
  const task = (
    title: string,
    importance: Importance,
    opts: Partial<TaskRow> & { urgency_manual?: Urgency } = {},
  ): TaskRow => ({
    id: `demo-task-${order + 1}`,
    user_id: DEMO_USER_ID,
    title,
    note: null,
    importance,
    urgency_manual: opts.urgency_manual ?? 1,
    due_on: null,
    due_time: null,
    remind_before: [],
    scheduled_on: today,
    category_id: null,
    template_id: null,
    occurrence_on: null,
    order_index: order++,
    status: 'open',
    completed_at: null,
    urgency_at_completion: null,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
    ...opts,
  })

  const cat = (icon: string) => `cat-${icon}`

  await db.tasks.bulkPut([
    // Борд дня
    task('Сдать отчёт по проекту', 4, { due_on: today, due_time: '18:00', category_id: cat('work') }),
    task('Записаться к стоматологу', 3, { due_on: addDays(today, 1), category_id: cat('health') }),
    task('Вынести мусор', 2, { due_on: today, category_id: cat('chores') }),
    task('Корм коту', 1, { due_on: addDays(today, 2), category_id: cat('chores') }),
    task('Полить цветы', 1, { due_on: addDays(today, 5), category_id: cat('home') }),
    task('Дочитать главу', 2, { due_on: addDays(today, 6), category_id: cat('study') }),
    task('Разобрать фотоархив', 2, { urgency_manual: 1, category_id: cat('home') }),
    // Сделано
    task('Позвонить маме', 2, {
      status: 'done',
      completed_at: ts,
      urgency_at_completion: 2,
      category_id: cat('people'),
    }),
    task('Проездной', 1, {
      status: 'done',
      completed_at: ts,
      urgency_at_completion: 3,
      category_id: cat('chores'),
    }),
    // Висят
    task('Оплатить страховку машины', 3, {
      scheduled_on: addDays(today, -9),
      due_on: addDays(today, -2),
      category_id: cat('money'),
    }),
    task('Подготовить презентацию', 2, {
      scheduled_on: addDays(today, -2),
      due_on: addDays(today, 2),
      category_id: cat('work'),
    }),
    task('Почистить почту', 1, { scheduled_on: addDays(today, -1), urgency_manual: 2, category_id: cat('work') }),
    task('Выбрать подарок', 1, { scheduled_on: addDays(today, -3), urgency_manual: 1, category_id: cat('people') }),
    // Инбокс — без даты
    task('Оплатить страховку', 2, { scheduled_on: null, due_on: today, category_id: cat('money') }),
    task('Починить кран на кухне', 2, { scheduled_on: null, due_on: addDays(today, 4), category_id: cat('home') }),
    task('Помыть окна', 1, { scheduled_on: null, urgency_manual: 1, category_id: cat('chores') }),
    task('Записать расходы за месяц', 1, { scheduled_on: null, urgency_manual: 2, category_id: cat('money') }),
  ])
}
