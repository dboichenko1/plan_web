import type { Theme } from '../types'

export const paper: Theme = {
  id: 'paper',
  name: 'Бумага',
  kind: 'light',
  bg: '#F2F3F5',
  surface: '#FFFFFF',
  surface2: '#E8EAEE',
  line: '#D5D9DF',
  text: '#14171C',
  textMuted: '#5C646E',
  textQuiet: '#8E97A3',
  urgency: ['#5A6B84', '#339066', '#C97A15', '#D02B2B'],
  onUrgency: ['#FFFFFF', '#14171C', '#14171C', '#FFFFFF'],
  slipped: { fill: '#E4E6EA', text: '#5C646E' },
  expired: { outline: '#D02B2B' },
  done: { fill: '#E9ECF3', text: '#61676F' },
  accent: '#3A6EA5',
  accentAlt: '#D02B2B',
  scrim: 'rgba(20, 23, 28, 0.42)',
  categoryChart: ['#7F77DD', '#1D9E75', '#D85A30', '#378ADD', '#D4537E', '#888780', '#BA7517'],
}
