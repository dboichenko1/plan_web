// Сквозной сценарий: создать задачу, перетащить, выполнить, увидеть в статистике.
// Жесты — мышиные аналоги; настоящие тач-жесты проверяются на iPhone руками.
// Вьюпорт эмулятора ниже макетного (660px), поэтому перед каждым жестом
// плитка прокручивается в видимую область.

import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

async function visibleBox(page: Page, locator: Locator) {
  // Борд переупаковывается с анимацией — элемент может пересоздаться под руками.
  for (let attempt = 0; ; attempt++) {
    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 3000 })
      break
    } catch (e) {
      if (attempt >= 3) throw e
      await page.waitForTimeout(400)
    }
  }
  await page.waitForTimeout(300)
  const box = await locator.boundingBox()
  if (!box) throw new Error('элемент не найден')
  return box
}

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
  await page.waitForTimeout(600)

  // Перетащить долгим нажатием на соседнюю плитку выше
  const created = page.getByText('Сквозная проверка').first()
  const from = await visibleBox(page, created)
  const target = await page.getByText('Дочитать главу').first().boundingBox()
  if (!target) throw new Error('цель не найдена')
  await page.mouse.move(from.x + 40, from.y + 10)
  await page.mouse.down()
  await page.waitForTimeout(300)
  await page.mouse.move(target.x + 40, target.y + 10, { steps: 10 })
  await page.waitForTimeout(350)
  await page.mouse.up()
  await page.waitForTimeout(400)
  await expect(page.getByText('Сквозная проверка')).toBeVisible()

  // Выполнить свайпом вправо
  const doneBefore = await page.getByText(/сделано · \d+/).textContent()
  const t2 = await visibleBox(page, page.getByText('Сквозная проверка').first())
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
  await expect(page.getByText('Индекс пожара')).toBeVisible()
})
