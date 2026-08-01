import { describe, it, expect } from 'vitest'
import { effectiveUrgency } from './urgency'
import { addDays } from './date'
import type { Urgency } from './types'

const TODAY = '2026-08-01'

function taskDueIn(offset: number) {
  return { due_on: addDays(TODAY, offset), urgency_manual: 1 as Urgency }
}

describe('effectiveUrgency', () => {
  describe('без due_on возвращает ручную срочность', () => {
    const manuals: Urgency[] = [1, 2, 3, 4]

    it.each(manuals)('due_on отсутствует, urgency_manual=%i', (u) => {
      expect(effectiveUrgency({ urgency_manual: u }, TODAY)).toBe(u)
    })

    it.each(manuals)('due_on=null, urgency_manual=%i', (u) => {
      expect(effectiveUrgency({ due_on: null, urgency_manual: u }, TODAY)).toBe(u)
    })
  })

  describe('границы по дедлайну', () => {
    it('вчера (−1) → 4', () => {
      expect(effectiveUrgency(taskDueIn(-1), TODAY)).toBe(4)
    })

    it('давно просрочено (−30) → 4', () => {
      expect(effectiveUrgency(taskDueIn(-30), TODAY)).toBe(4)
    })

    it('сегодня (0) → 4', () => {
      expect(effectiveUrgency(taskDueIn(0), TODAY)).toBe(4)
    })

    it('завтра (+1) → 3', () => {
      expect(effectiveUrgency(taskDueIn(1), TODAY)).toBe(3)
    })

    it('+3 → 3', () => {
      expect(effectiveUrgency(taskDueIn(3), TODAY)).toBe(3)
    })

    it('+4 → 2', () => {
      expect(effectiveUrgency(taskDueIn(4), TODAY)).toBe(2)
    })

    it('+7 → 2', () => {
      expect(effectiveUrgency(taskDueIn(7), TODAY)).toBe(2)
    })

    it('+8 → 1', () => {
      expect(effectiveUrgency(taskDueIn(8), TODAY)).toBe(1)
    })
  })

  describe('дедлайн приоритетнее ручной срочности', () => {
    it('urgency_manual=1 не спасает от горящего дедлайна', () => {
      expect(
        effectiveUrgency({ due_on: TODAY, urgency_manual: 1 }, TODAY),
      ).toBe(4)
    })

    it('urgency_manual=4 не поднимает далёкий дедлайн', () => {
      expect(
        effectiveUrgency({ due_on: addDays(TODAY, 30), urgency_manual: 4 }, TODAY),
      ).toBe(1)
    })
  })

  describe('переход через границы месяца и года', () => {
    it('через новый год: 2026-12-30 → 2027-01-02 это +3 → 3', () => {
      expect(
        effectiveUrgency({ due_on: '2027-01-02', urgency_manual: 1 }, '2026-12-30'),
      ).toBe(3)
    })

    it('через новый год: 2026-12-30 → 2027-01-07 это +8 → 1', () => {
      expect(
        effectiveUrgency({ due_on: '2027-01-07', urgency_manual: 4 }, '2026-12-30'),
      ).toBe(1)
    })

    it('через границу месяца: 2026-08-31 → 2026-09-04 это +4 → 2', () => {
      expect(
        effectiveUrgency({ due_on: '2026-09-04', urgency_manual: 1 }, '2026-08-31'),
      ).toBe(2)
    })

    it('февраль високосного 2028: 2028-02-28 → 2028-03-01 это +2 → 3', () => {
      expect(
        effectiveUrgency({ due_on: '2028-03-01', urgency_manual: 1 }, '2028-02-28'),
      ).toBe(3)
    })
  })
})
