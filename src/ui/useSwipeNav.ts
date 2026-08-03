import { useRef, type PointerEvent } from 'react'

// Горизонтальный свайп по контенту для листания периодов (день/неделя/месяц).
// Срабатывает только на явно горизонтальном длинном жесте, чтобы не мешать
// вертикальному скроллу и перетаскиванию плиток (у тех своя цель и задержка).

export function useSwipeNav(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return
    start.current = { x: e.clientX, y: e.clientY, t: Date.now() }
  }

  const onPointerUp = (e: PointerEvent) => {
    const s = start.current
    start.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    const dt = Date.now() - s.t
    // Длинный, быстрый, явно горизонтальный жест.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2 || dt > 600) return
    if (dx > 0) onPrev()
    else onNext()
  }

  return { onPointerDown, onPointerUp }
}
