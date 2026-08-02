// Горизонтальный свайп строки с подложками действий.
// Захватываем жест только когда движение явно горизонтальное — иначе списку
// не проскроллиться; вертикаль отдаём браузеру через touch-action: pan-y.

import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

const TRIGGER = 80

export function SwipeRow({
  children,
  rightLabel,
  leftLabel,
  onSwipeRight,
  onSwipeLeft,
  onTap,
  disabled = false,
}: {
  children: ReactNode
  /** Подложка слева, открывается свайпом вправо. */
  rightLabel: ReactNode
  /** Подложка справа, открывается свайпом влево. */
  leftLabel: ReactNode
  onSwipeRight: () => void
  onSwipeLeft: () => void
  onTap?: () => void
  /** Пока идёт перетаскивание, свайп молчит. */
  disabled?: boolean
}) {
  const [dx, setDx] = useState(0)
  const dxRef = useRef(0)
  const [animating, setAnimating] = useState(false)
  const start = useRef<{ x: number; y: number; captured: boolean; id: number } | null>(null)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    start.current = { x: e.clientX, y: e.clientY, captured: false, id: e.pointerId }
    setAnimating(false)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current
    if (!s) return
    if (disabled) {
      start.current = null
      setDx(0)
      return
    }
    const ddx = e.clientX - s.x
    const ddy = e.clientY - s.y
    if (!s.captured) {
      if (Math.abs(ddx) < 8 || Math.abs(ddx) < Math.abs(ddy) * 1.4) return
      s.captured = true
      e.currentTarget.setPointerCapture(s.id)
    }
    // Быстрый свайп отпускается раньше, чем React дорендерит dx —
    // актуальное значение живёт в ref.
    dxRef.current = ddx
    setDx(ddx)
  }

  const finish = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current
    start.current = null
    if (!s) return
    if (!s.captured) {
      if (onTap && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) onTap()
      return
    }
    setAnimating(true)
    const final = dxRef.current
    dxRef.current = 0
    setDx(0)
    if (final > TRIGGER) onSwipeRight()
    else if (final < -TRIGGER) onSwipeLeft()
  }

  return (
    <div
      className="relative overflow-hidden rounded-tile"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <div
        className="absolute inset-0 flex items-center pl-3.5"
        style={{ background: 'var(--u2)', opacity: dx > 8 ? 1 : 0 }}
      >
        {rightLabel}
      </div>
      <div
        className="absolute inset-0 flex items-center justify-end pr-3.5"
        style={{ background: 'var(--accent-alt)', opacity: dx < -8 ? 1 : 0 }}
      >
        {leftLabel}
      </div>
      <div
        className="relative"
        style={{
          transform: `translateX(${dx}px)`,
          transition: animating ? 'transform 180ms ease' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
