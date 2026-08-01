// Охранный тест: блок тем в tokens.css обязан совпадать с реестром
// src/domain/themes/. Разъехались — запусти npm run gen:tokens.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { THEMES } from '../src/domain/themes/index.ts'
// @ts-expect-error — обычный JS без деклараций, общий с генератором
import { buildThemesCss } from '../scripts/build-themes-css.mjs'

describe('tokens.css', () => {
  it('блок тем совпадает с реестром', () => {
    const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
    const block = css.split('/* generated:themes:start */')[1]?.split('/* generated:themes:end */')[0]
    expect(block).toBeDefined()
    expect(block?.trim()).toBe((buildThemesCss(THEMES) as string).trim())
  })

  it('каждая тема реестра имеет селектор в CSS', () => {
    const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
    for (const t of THEMES) {
      expect(css).toContain(`:root[data-theme='${t.id}']`)
    }
  })
})
