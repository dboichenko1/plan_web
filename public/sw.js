// Service worker: веб-пуши и бейдж на иконке (ТЗ §5.10, §8).
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
  event.waitUntil(clients.openWindow('/'))
})

// --- Офлайн-оболочка — фаза 12 ---
// Здесь появятся install/activate с прекешем статики и fetch-обработчик;
// пока service worker занимается только пушами.
