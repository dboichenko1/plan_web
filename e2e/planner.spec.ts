// Сквозной сценарий: создать задачу, перетащить, выполнить, увидеть в статистике.
// Жесты — мышиные аналоги; настоящие тач-жесты проверяются на iPhone руками.

import { expect, test } from '@playwright/test'

test('создать → перетащить → выполнить → статистика', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme_mode', 'dark')
    localStorage.setItem('theme_dark_id', 'graphite')
  })
  await page.goto('/')
  await expect(page.getByText('занято', { exact: false })).toBeVisible()

  // Создать задачу с ключевой важностью
  await page.getByRole('button', { name: 'Добавить задачу' }).click()
  await page.getByPlaceholder('Название задачи').fill('Сквозная проверка')
  await page.getByRole('button', { name: 'Ключевая' }).click()
  await page.getByRole('button', { name: /^Добавить задачу$/ }).last().click()
  await expect(page.getByText('Сквозная проверка')).toBeVisible()

  // Перетащить: долгое нажатие и перенос в начало борда
  const tile = page.getByText('Сквозная проверка').first()
  const from = await tile.boundingBox()
  const target = await page.getByText('Сдать отчёт по проекту').first().boundingBox()
  if (!from || !target) throw new Error('плитки не найдены')
  await page.mouse.move(from.x + 40, from.y + 10)
  await page.mouse.down()
  await page.waitForTimeout(300)
  await page.mouse.move(target.x + 60, target.y - 30, { steps: 10 })
  await page.waitForTimeout(350)
  await page.mouse.up()
  await page.waitForTimeout(400)
  await expect(page.getByText('Сквозная проверка')).toBeVisible()

  // Выполнить свайпом вправо
  const t2 = await page.getByText('Сквозная проверка').first().boundingBox()
  if (!t2) throw new Error('плитка не найдена')
  const doneBefore = await page.getByText(/сделано · \d+/).textContent()
  await page.mouse.move(t2.x + 30, t2.y + 15)
  await page.mouse.down()
  await page.mouse.move(t2.x + 170, t2.y + 17, { steps: 4 })
  await page.mouse.up()
  await page.waitForTimeout(700)
  const doneAfter = await page.getByText(/сделано · \d+/).textContent()
  expect(doneAfter).not.toBe(doneBefore)

  // Увидеть в статистике
  await page.getByText('статистика', { exact: true }).click()
  await expect(page.getByText('Выполнено', { exact: false })).toBeVisible()
})
