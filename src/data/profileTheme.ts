// Минимальный помощник записи выбора темы в профиль (Dexie + outbox, ).
// Если появится общий src/data/profile.ts с updateProfile — перенести туда.

import { db } from './db'
import { pokeSync } from './syncSignal'

export type ThemePrefsPatch = {
  mode: 'light' | 'dark' | 'system'
  darkId: string
  lightId: string
}

/** Сохраняет выбор темы в локальный профиль и кладёт upsert в outbox. */
export async function saveThemePrefs(userId: string, prefs: ThemePrefsPatch): Promise<void> {
  const patch = {
    theme_mode: prefs.mode,
    theme_dark_id: prefs.darkId,
    theme_light_id: prefs.lightId,
  }
  const now = new Date().toISOString()
  // Строки профиля может ещё не быть (первый вход до pull) — тогда локально
  // не пишем, сервер всё равно получит upsert ниже и вернёт строку pull'ом.
  await db.profiles.update(userId, { ...patch, updated_at: now })
  await db.outbox.add({
    entity: 'profiles',
    entity_id: userId,
    op: 'upsert',
    payload: { id: userId, ...patch },
    created_at: now,
    tries: 0,
  })
  pokeSync()
}
