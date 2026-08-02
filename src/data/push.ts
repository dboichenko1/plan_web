// Подписка на веб-пуши. На iOS запрос разрешения работает
// только из жеста пользователя, поэтому ensurePushSubscription зовётся
// исключительно по нажатию кнопки, никогда автоматически.

import { db } from './db'
import type { PushSubscriptionRow } from './contract'
import { pokeSync } from './syncSignal'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function registerSW(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  await navigator.serviceWorker.register('/sw.js')
}

/** VAPID-ключ приходит в base64url, pushManager хочет сырые байты. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function deviceLabel(): string {
  const ua = navigator.userAgent
  if (ua.includes('iPhone')) return 'iPhone'
  if (ua.includes('iPad')) return 'iPad'
  if (ua.includes('Macintosh')) return 'Mac'
  return 'другое'
}

export async function ensurePushSubscription(
  userId: string,
): Promise<'subscribed' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  // register идемпотентен; без него .ready ждал бы вечно, если SW ещё не ставили.
  await registerSW()
  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    }))

  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.['p256dh']
  const auth = json.keys?.['auth']
  if (!endpoint || !p256dh || !auth) return 'unsupported'

  // id стабилен для endpoint: повторное нажатие обновляет строку, а не плодит дубли.
  const existing = await db.push_subscriptions.where('endpoint').equals(endpoint).first()
  const nowIso = new Date().toISOString()
  const row: PushSubscriptionRow = {
    id: existing?.id ?? crypto.randomUUID(),
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    device_label: deviceLabel(),
    last_seen_at: nowIso,
    created_at: existing?.created_at ?? nowIso,
  }
  await db.push_subscriptions.put(row)

  // created_at в outbox не кладём: его ставит сервер (как в repo.ts).
  const { created_at, ...payload } = row
  void created_at
  await db.outbox.add({
    entity: 'push_subscriptions',
    entity_id: row.id,
    op: 'upsert',
    payload,
    created_at: nowIso,
    tries: 0,
  })
  pokeSync()
  return 'subscribed'
}
