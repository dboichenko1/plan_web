// Общие типы домена. Календарные даты — строки 'YYYY-MM-DD', время — 'HH:MM'.
// Строки сравниваются лексикографически как даты: a < b работает без преобразований.

export type DateStr = string
export type TimeStr = string

export type Importance = 1 | 2 | 3 | 4
export type Urgency = 1 | 2 | 3 | 4

export type TaskState = 'live' | 'slipped' | 'expired' | 'done'

/** Минимальный срез задачи, который нужен доменным функциям. */
export type TaskLike = {
  status: 'open' | 'done'
  importance: Importance
  urgency_manual: Urgency
  due_on?: DateStr | null
  scheduled_on?: DateStr | null
}

export type Theme = {
  id: string
  name: string
  kind: 'dark' | 'light'

  bg: string
  surface: string
  surface2: string
  line: string
  text: string
  textMuted: string
  textQuiet: string

  urgency: [string, string, string, string]
  onUrgency: [string, string, string, string]

  slipped: { fill: string; text: string }
  expired: { outline: string }
  done: { fill: string; text: string }

  accent: string
  accentAlt: string
  /** Затемнение под шторками; задан макетами, чекер его не проверяет. */
  scrim: string
  categoryChart: string[]
}
