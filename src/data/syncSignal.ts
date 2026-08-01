// Толчок отправки outbox. До фазы 7 подписчиков нет — мутации просто копятся.

type Listener = () => void

const listeners = new Set<Listener>()

export function pokeSync(): void {
  for (const l of listeners) l()
}

export function onSyncPoke(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
