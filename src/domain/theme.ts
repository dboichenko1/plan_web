// Проверки палитры темы: контраст по WCAG 2.x и перцептивные
// расстояния цветов. Расстояния считаются в OKLab, а не в RGB — в RGB
// перцептивная разница считается неправильно.

import type { Theme } from './types'

export type ThemeCheck = { errors: string[]; warnings: string[] }

// Вход — '#RRGGBB' в любом регистре; каналы в диапазоне 0..1.
function srgbChannels(hex: string): [number, number, number] {
  const h = hex.slice(1)
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ]
}

function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = srgbChannels(hex)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  const lighter = la >= lb ? la : lb
  const darker = la >= lb ? lb : la
  return (lighter + 0.05) / (darker + 0.05)
}

// Преобразование Бьёрна Оттоссона: linear sRGB → LMS → кубический корень → OKLab.
function toOklab(hex: string): [number, number, number] {
  const [r0, g0, b0] = srgbChannels(hex)
  const r = linearize(r0)
  const g = linearize(g0)
  const b = linearize(b0)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

export function oklabDistance(hexA: string, hexB: string): number {
  const [la, aa, ba] = toOklab(hexA)
  const [lb, ab, bb] = toOklab(hexB)
  return Math.hypot(la - lb, aa - ab, ba - bb)
}

const LEVELS = [0, 1, 2, 3] as const

export function checkTheme(t: Theme): ThemeCheck {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Текст на плашках срочности читается.
  for (const i of LEVELS) {
    const r = contrastRatio(t.onUrgency[i], t.urgency[i])
    if (r < 4.5) {
      errors.push(
        `контраст onUrgency[${i}] (${t.onUrgency[i]}) на urgency[${i}] (${t.urgency[i]}) = ${r.toFixed(2)}, требуется >= 4.5`,
      )
    }
  }

  // 2. Основной и приглушённый текст на фоне.
  const textOnBg = contrastRatio(t.text, t.bg)
  if (textOnBg < 7) {
    errors.push(`контраст text (${t.text}) на bg (${t.bg}) = ${textOnBg.toFixed(2)}, требуется >= 7`)
  }
  const mutedOnBg = contrastRatio(t.textMuted, t.bg)
  if (mutedOnBg < 4.5) {
    errors.push(
      `контраст textMuted (${t.textMuted}) на bg (${t.bg}) = ${mutedOnBg.toFixed(2)}, требуется >= 4.5`,
    )
  }

  // 3. Текст на плашках slipped и done.
  const slippedText = contrastRatio(t.slipped.text, t.slipped.fill)
  if (slippedText < 4.5) {
    errors.push(
      `контраст slipped.text (${t.slipped.text}) на slipped.fill (${t.slipped.fill}) = ${slippedText.toFixed(2)}, требуется >= 4.5`,
    )
  }
  const doneText = contrastRatio(t.done.text, t.done.fill)
  if (doneText < 4.5) {
    errors.push(
      `контраст done.text (${t.done.text}) на done.fill (${t.done.fill}) = ${doneText.toFixed(2)}, требуется >= 4.5`,
    )
  }

  // 4. Соседние уровни срочности различимы.
  const adjacentLevels = [
    [0, 1],
    [1, 2],
    [2, 3],
  ] as const
  for (const [i, j] of adjacentLevels) {
    const d = oklabDistance(t.urgency[i], t.urgency[j])
    if (d < 0.1) {
      errors.push(
        `OKLab-расстояние urgency[${i}]–urgency[${j}] (${t.urgency[i]} и ${t.urgency[j]}) = ${d.toFixed(3)}, требуется >= 0.1`,
      )
    }
  }

  // 5. Заливки slipped/done и фон различимы попарно.
  const fillPairs = [
    ['slipped.fill', t.slipped.fill, 'done.fill', t.done.fill],
    ['slipped.fill', t.slipped.fill, 'bg', t.bg],
    ['done.fill', t.done.fill, 'bg', t.bg],
  ] as const
  for (const [nameA, hexA, nameB, hexB] of fillPairs) {
    const d = oklabDistance(hexA, hexB)
    if (d < 0.015) {
      errors.push(
        `OKLab-расстояние ${nameA}–${nameB} (${hexA} и ${hexB}) = ${d.toFixed(3)}, требуется >= 0.015`,
      )
    }
  }

  // 6. Плашка slipped не маскируется ни под один уровень срочности.
  for (const i of LEVELS) {
    const d = oklabDistance(t.slipped.fill, t.urgency[i])
    if (d < 0.1) {
      errors.push(
        `OKLab-расстояние slipped.fill–urgency[${i}] (${t.slipped.fill} и ${t.urgency[i]}) = ${d.toFixed(3)}, требуется >= 0.1`,
      )
    }
  }

  if (t.categoryChart.length !== 7) {
    errors.push(`categoryChart: требуется ровно 7 цветов, получено ${t.categoryChart.length}`)
  }

  // 7 (мягкое). Уровень 4 не должен быть менее заметным, чем 2 и 3;
  // заметность — расстояние до фона.
  const dist4 = oklabDistance(t.urgency[3], t.bg)
  for (const i of [1, 2] as const) {
    const di = oklabDistance(t.urgency[i], t.bg)
    if (dist4 < di) {
      warnings.push(
        `urgency[3] (${t.urgency[3]}) выделяется на bg слабее, чем urgency[${i}] (${t.urgency[i]}): ${dist4.toFixed(3)} < ${di.toFixed(3)}`,
      )
    }
  }

  return { errors, warnings }
}
