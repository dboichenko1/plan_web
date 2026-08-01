import type { Theme } from '../types'

export const mocha: Theme = {
  id: 'mocha',
  name: 'Мокко',
  kind: 'dark',
  bg: '#1E1E2E',
  surface: '#181825',
  surface2: '#313244',
  line: '#45475A',
  text: '#CDD6F4',
  textMuted: '#A6ADC8',
  textQuiet: '#7F849C',
  urgency: ['#7F849C', '#A6E3A1', '#FAB387', '#F38BA8'],
  onUrgency: ['#11111B', '#11111B', '#11111B', '#11111B'],
  slipped: { fill: '#585B70', text: '#CDD6F4' },
  expired: { outline: '#F38BA8' },
  done: { fill: '#313244', text: '#969BB4' },
  accent: '#CBA6F7',
  accentAlt: '#F5C2E7',
  scrim: 'rgba(10, 10, 18, 0.62)',
  categoryChart: ['#7F77DD', '#1D9E75', '#D85A30', '#378ADD', '#D4537E', '#888780', '#BA7517'],
}
