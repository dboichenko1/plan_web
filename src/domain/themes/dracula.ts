import type { Theme } from '../types'

export const dracula: Theme = {
  id: 'dracula',
  name: 'Дракула',
  kind: 'dark',
  bg: '#282A36',
  surface: '#21222C',
  surface2: '#44475A',
  line: '#383A4A',
  text: '#F8F8F2',
  textMuted: '#9AA4C8',
  textQuiet: '#6272A4',
  urgency: ['#6070A1', '#3FD968', '#FFB86C', '#FF5555'],
  onUrgency: ['#F8F8F2', '#282A36', '#282A36', '#282A36'],
  slipped: { fill: '#44475A', text: '#C5CBE0' },
  expired: { outline: '#FF5555' },
  done: { fill: '#343746', text: '#8EA0D5' },
  accent: '#BD93F9',
  accentAlt: '#FF79C6',
  scrim: 'rgba(14, 15, 22, 0.62)',
  categoryChart: ['#7F77DD', '#1D9E75', '#D85A30', '#378ADD', '#D4537E', '#888780', '#BA7517'],
}
