import type { Theme } from '../types'
import { graphite } from './graphite.ts'
import { paper } from './paper.ts'
import { dracula } from './dracula.ts'
import { mocha } from './mocha.ts'

export const THEMES: readonly Theme[] = [graphite, paper, dracula, mocha]

export const DEFAULT_DARK_ID = 'graphite'
export const DEFAULT_LIGHT_ID = 'paper'

export function themeById(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id)
}
