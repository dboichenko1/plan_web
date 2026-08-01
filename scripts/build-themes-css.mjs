// Собирает CSS-блок тем из реестра. Используется генератором (gen-tokens.mjs)
// и охранным тестом: блок в tokens.css обязан совпадать с реестром байт в байт.

export function buildThemesCss(themes) {
  const vars = (t) => {
    const rows = [
      ['color-scheme', t.kind],
      ['--bg', t.bg],
      ['--surface', t.surface],
      ['--surface2', t.surface2],
      ['--line', t.line],
      ['--text', t.text],
      ['--text-muted', t.textMuted],
      ['--text-quiet', t.textQuiet],
      ...t.urgency.map((c, i) => [`--u${i + 1}`, c]),
      ...t.onUrgency.map((c, i) => [`--on-u${i + 1}`, c]),
      ['--slipped-fill', t.slipped.fill],
      ['--slipped-text', t.slipped.text],
      ['--expired-outline', t.expired.outline],
      ['--done-fill', t.done.fill],
      ['--done-text', t.done.text],
      ['--accent', t.accent],
      ['--accent-alt', t.accentAlt],
      ['--scrim', t.scrim],
      ...t.categoryChart.map((c, i) => [`--cat-${i + 1}`, c]),
    ]
    return rows.map(([k, v]) => `  ${k}: ${String(v).toLowerCase()};`).join('\n')
  }

  return themes
    .map((t, i) => {
      const selector =
        i === 0 ? `:root,\n:root[data-theme='${t.id}']` : `:root[data-theme='${t.id}']`
      return `${selector} {\n${vars(t)}\n}`
    })
    .join('\n\n')
}
