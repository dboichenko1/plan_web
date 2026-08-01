import type { Theme } from '../types'

export const graphite: Theme = {
  id: 'graphite',
  name: 'Графит',
  kind: 'dark',
  bg: '#0F1114',
  surface: '#191C21',
  surface2: '#22262C',
  line: '#2C3138',
  text: '#ECEFF3',
  textMuted: '#8E97A3',
  textQuiet: '#5C646E',
  urgency: ['#47576F', '#3FA97A', '#E8952E', '#DC3435'],
  onUrgency: ['#DCE3EC', '#0F1114', '#0F1114', '#FFFFFF'],
  slipped: { fill: '#2E3238', text: '#A6AEB8' },
  expired: { outline: '#DC3435' },
  done: { fill: '#1E2228', text: '#808B94' },
  accent: '#5B7FA8',
  accentAlt: '#DC3435',
  scrim: 'rgba(4, 5, 7, 0.62)',
  categoryChart: ['#7F77DD', '#1D9E75', '#D85A30', '#378ADD', '#D4537E', '#888780', '#BA7517'],
}
