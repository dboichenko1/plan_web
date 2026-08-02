import { describe, expect, it } from 'vitest'
import type { Theme } from './types'
import { checkTheme, contrastRatio, oklabDistance } from './theme'
import { DEFAULT_DARK_ID, DEFAULT_LIGHT_ID, THEMES, themeById } from './themes'
import { graphite } from './themes/graphite'

describe('contrastRatio', () => {
  it('белый на чёрном даёт максимум 21', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21)
  })

  it('симметричен относительно порядка аргументов', () => {
    expect(contrastRatio('#ECEFF3', '#0F1114')).toBe(contrastRatio('#0F1114', '#ECEFF3'))
  })

  it('не зависит от регистра hex', () => {
    expect(contrastRatio('#ecEFf3', '#0f1114')).toBe(contrastRatio('#ECEFF3', '#0F1114'))
  })

  it('одинаковые цвета дают 1', () => {
    expect(contrastRatio('#8E97A3', '#8E97A3')).toBe(1)
  })
})

describe('oklabDistance', () => {
  it('нулевое расстояние для одинаковых цветов', () => {
    expect(oklabDistance('#DC3435', '#DC3435')).toBe(0)
  })

  it('чёрный–белый дальше друг от друга, чем соседние серые', () => {
    expect(oklabDistance('#000000', '#FFFFFF')).toBeGreaterThan(oklabDistance('#777777', '#888888'))
  })

  it('симметрично относительно порядка аргументов', () => {
    expect(oklabDistance('#3FA97A', '#E8952E')).toBe(oklabDistance('#E8952E', '#3FA97A'))
  })
})

describe('реестр тем', () => {
  it('содержит четыре темы в заявленном порядке', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['graphite', 'paper', 'dracula', 'mocha'])
  })

  for (const t of THEMES) {
    it(`${t.id}: проходит все жёсткие правила`, () => {
      expect(checkTheme(t).errors).toEqual([])
    })
  }

  it('фактические предупреждения по каждой теме (снапшот)', () => {
    const warningsByTheme = Object.fromEntries(THEMES.map((t) => [t.id, checkTheme(t).warnings]))
    // У тёмных тем красный четвёртый уровень по расстоянию до фона уступает
    // зелёному и оранжевому — осознанная цена этой темы.
    expect(warningsByTheme).toEqual({
      graphite: [
        'urgency[3] (#DC3435) выделяется на bg слабее, чем urgency[1] (#3FA97A): 0.462 < 0.499',
        'urgency[3] (#DC3435) выделяется на bg слабее, чем urgency[2] (#E8952E): 0.462 < 0.583',
      ],
      paper: [],
      dracula: [
        'urgency[3] (#FF5555) выделяется на bg слабее, чем urgency[1] (#3FD968): 0.448 < 0.538',
        'urgency[3] (#FF5555) выделяется на bg слабее, чем urgency[2] (#FFB86C): 0.448 < 0.564',
      ],
      mocha: [
        'urgency[3] (#F38BA8) выделяется на bg слабее, чем urgency[1] (#A6E3A1): 0.528 < 0.629',
        'urgency[3] (#F38BA8) выделяется на bg слабее, чем urgency[2] (#FAB387): 0.528 < 0.594',
      ],
    })
  })

  it('themeById находит тему по id и возвращает undefined для неизвестного', () => {
    expect(themeById('dracula')?.name).toBe('Дракула')
    expect(themeById('nope')).toBeUndefined()
  })

  it('темы по умолчанию есть в реестре и совпадают по kind', () => {
    expect(themeById(DEFAULT_DARK_ID)?.kind).toBe('dark')
    expect(themeById(DEFAULT_LIGHT_ID)?.kind).toBe('light')
  })
})

describe('checkTheme: жёсткие правила на сломанных вариантах', () => {
  it('правило 1: недостаточный контраст onUrgency на urgency', () => {
    const broken: Theme = {
      ...graphite,
      onUrgency: [graphite.onUrgency[0], graphite.onUrgency[1], graphite.urgency[2], graphite.onUrgency[3]],
    }
    expect(checkTheme(broken).errors).toContain(
      'контраст onUrgency[2] (#E8952E) на urgency[2] (#E8952E) = 1.00, требуется >= 4.5',
    )
  })

  it('правило 2: text сливается с bg', () => {
    const broken: Theme = { ...graphite, text: graphite.bg }
    expect(checkTheme(broken).errors).toContain(
      'контраст text (#0F1114) на bg (#0F1114) = 1.00, требуется >= 7',
    )
  })

  it('правило 2: textMuted сливается с bg', () => {
    const broken: Theme = { ...graphite, textMuted: graphite.bg }
    expect(checkTheme(broken).errors).toContain(
      'контраст textMuted (#0F1114) на bg (#0F1114) = 1.00, требуется >= 4.5',
    )
  })

  it('правило 2: контраст text ниже 7, но выше 4.5 — всё равно ошибка', () => {
    // textMuted графита на bg контрастен ~6.4: годится для textMuted, но не для text.
    const broken: Theme = { ...graphite, text: graphite.textMuted }
    const { errors } = checkTheme(broken)
    expect(errors.some((e) => e.startsWith('контраст text ('))).toBe(true)
    expect(errors.some((e) => e.startsWith('контраст textMuted ('))).toBe(false)
  })

  it('правило 3: slipped.text сливается с slipped.fill', () => {
    const broken: Theme = { ...graphite, slipped: { fill: graphite.slipped.fill, text: graphite.slipped.fill } }
    expect(checkTheme(broken).errors).toContain(
      'контраст slipped.text (#2E3238) на slipped.fill (#2E3238) = 1.00, требуется >= 4.5',
    )
  })

  it('правило 3: done.text сливается с done.fill', () => {
    const broken: Theme = { ...graphite, done: { fill: graphite.done.fill, text: graphite.done.fill } }
    expect(checkTheme(broken).errors).toContain(
      'контраст done.text (#1E2228) на done.fill (#1E2228) = 1.00, требуется >= 4.5',
    )
  })

  it('правило 4: соседние уровни срочности неразличимы', () => {
    const broken: Theme = {
      ...graphite,
      urgency: [graphite.urgency[0], graphite.urgency[0], graphite.urgency[2], graphite.urgency[3]],
    }
    expect(checkTheme(broken).errors).toContain(
      'OKLab-расстояние urgency[0]–urgency[1] (#47576F и #47576F) = 0.000, требуется >= 0.1',
    )
  })

  it('правило 5: done.fill сливается с bg', () => {
    const broken: Theme = { ...graphite, done: { fill: graphite.bg, text: graphite.done.text } }
    expect(checkTheme(broken).errors).toContain(
      'OKLab-расстояние done.fill–bg (#0F1114 и #0F1114) = 0.000, требуется >= 0.015',
    )
  })

  it('правило 5: slipped.fill сливается с done.fill', () => {
    const broken: Theme = {
      ...graphite,
      slipped: { fill: graphite.done.fill, text: graphite.slipped.text },
    }
    expect(checkTheme(broken).errors).toContain(
      'OKLab-расстояние slipped.fill–done.fill (#1E2228 и #1E2228) = 0.000, требуется >= 0.015',
    )
  })

  it('правило 6: slipped.fill маскируется под уровень срочности', () => {
    const broken: Theme = {
      ...graphite,
      slipped: { fill: graphite.urgency[0], text: graphite.slipped.text },
    }
    expect(checkTheme(broken).errors).toContain(
      'OKLab-расстояние slipped.fill–urgency[0] (#47576F и #47576F) = 0.000, требуется >= 0.1',
    )
  })

  it('categoryChart не из 7 цветов — ошибка', () => {
    const broken: Theme = { ...graphite, categoryChart: graphite.categoryChart.slice(0, 6) }
    expect(checkTheme(broken).errors).toContain('categoryChart: требуется ровно 7 цветов, получено 6')
  })
})

describe('checkTheme: мягкое правило 7', () => {
  it('тусклый четвёртый уровень даёт предупреждение, но не ошибку', () => {
    // Тёмно-красный близок к фону по светлоте, но проходит все жёсткие правила.
    const soft: Theme = {
      ...graphite,
      urgency: [graphite.urgency[0], graphite.urgency[1], graphite.urgency[2], '#6E1F20'],
    }
    const { errors, warnings } = checkTheme(soft)
    expect(errors).toEqual([])
    expect(warnings).toHaveLength(2)
    expect(warnings.every((w) => w.includes('urgency[3] (#6E1F20)'))).toBe(true)
  })

  it('у paper четвёртый уровень заметнее второго и третьего — предупреждений нет', () => {
    const paper = themeById('paper')
    expect(paper).toBeDefined()
    if (paper) expect(checkTheme(paper).warnings).toEqual([])
  })
})
