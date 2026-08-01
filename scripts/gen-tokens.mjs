// Перегенерирует блок тем в src/styles/tokens.css из реестра src/domain/themes/.
// Запуск: npm run gen:tokens (Node 24 исполняет TS напрямую).

import { readFileSync, writeFileSync } from 'node:fs'
import { THEMES } from '../src/domain/themes/index.ts'
import { buildThemesCss } from './build-themes-css.mjs'

const START = '/* generated:themes:start */'
const END = '/* generated:themes:end */'

const path = new URL('../src/styles/tokens.css', import.meta.url)
const css = readFileSync(path, 'utf8')
const start = css.indexOf(START)
const end = css.indexOf(END)
if (start === -1 || end === -1) throw new Error('в tokens.css нет маркеров generated:themes')

const next = css.slice(0, start + START.length) + '\n' + buildThemesCss(THEMES) + '\n' + css.slice(end)
writeFileSync(path, next)
console.log(`Блок тем перегенерирован: ${THEMES.length} темы`)
