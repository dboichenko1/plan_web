// Service worker: веб-пуши и бейдж на иконке.
// Полезная нагрузка пуша: { title, body, badge } — badge это число живых
// задач на сегодня, setAppBadge частично заменяет виджеты, которых у PWA нет.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Непарсибельный пуш показываем как есть, без тела.
  }
  const jobs = [
    self.registration.showNotification(data.title || 'Планировщик', {
      body: data.body || '',
      data,
    }),
  ]
  if (typeof data.badge === 'number') {
    jobs.push(navigator.setAppBadge?.(data.badge))
  }
  event.waitUntil(Promise.all(jobs))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(ROOT))
})

// --- Офлайн-оболочка — фаза 12 ---
// Vite хеширует имена чанков, поэтому precache-список захардкодить нельзя:
// на install кешируем только оболочку, остальное докешируется на лету в fetch.
const CACHE_NAME = 'plan-shell-v2'
// Корень приложения из scope: на GitHub Pages это подпуть вида '/plan_web/'.
const ROOT = new URL(self.registration.scope).pathname

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(ROOT)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Сносим кеши прошлых версий, чтобы не копить устаревшую оболочку.
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

// Обновление SW подхватывается при перезапуске приложения: страница шлёт
// SKIP_WAITING, и ожидающий воркер сразу становится активным.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Навигации: network-first, при офлайне отдаём закешированную оболочку
// (SPA — любой маршрут рендерится тем же index.html).
async function shellNetworkFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok) {
      // Свежую оболочку кладём под ключ корня, независимо от маршрута.
      await cache.put(ROOT, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(ROOT)
    return cached || Response.error()
  }
}

// Статика и шрифты: cache-first с дозаписью. Хешированные ассеты и шрифты
// иммутабельны, повторно ходить в сеть за ними незачем.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  // opaque (status 0) — no-cors ответ CSS Google Fonts, его тоже кешируем.
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(shellNetworkFirst(request))
    return
  }

  if (url.origin === self.location.origin) {
    // Same-origin статика: хешированные чанки Vite, иконки, манифест.
    if (
      url.pathname.startsWith(ROOT + 'assets/') ||
      url.pathname.startsWith(ROOT + 'icons/') ||
      url.pathname === ROOT + 'manifest.webmanifest'
    ) {
      event.respondWith(cacheFirst(request))
    }
    return
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request))
    return
  }

  // Всё остальное (в т.ч. Supabase: REST, auth, realtime) — мимо кеша,
  // обычный проход в сеть без respondWith.
})
