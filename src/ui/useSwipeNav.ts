import { useRef, type TouchEvent } from 'react'

// Горизонтальный свайп по контенту для листания периодов (день/неделя/месяц).
// touch-события надёжнее pointer в iOS PWA. Свайп, начатый на элементе с
// [data-noswipe] (плитка со своим жестом выполнения, строка инбокса), не
// листает — там своя горизонталь. Вертикальный скролл не трогаем.

export function useSwipeNav(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number; t: number; skip: boolean } | null>(null)

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    if (!t) return
    const target = e.target as HTMLElement | null
    start.current = {
      x: t.clientX,
      y: t.clientY,
      t: Date.now(),
      skip: Boolean(target?.closest('[data-noswipe]')),
    }
  }

  const onTouchEnd = (e: TouchEvent) => {
    const s = start.current
    start.current = null
    if (!s || s.skip) return
    const t = e.changedTouches[0]
    if (!t) return
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    const dt = Date.now() - s.t
    // Длинный, явно горизонтальный, не слишком медленный жест.
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.6 || dt > 800) return
    if (dx > 0) onPrev()
    else onNext()
  }

  return { onTouchStart, onTouchEnd }
}
