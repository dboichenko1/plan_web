import { useEffect, useState, type ReactNode } from 'react'

/** Шторка снизу. height — доля экрана ('70%') или 'auto'. */
export function Sheet({
  open,
  onClose,
  height = '70%',
  children,
}: {
  open: boolean
  onClose: () => void
  height?: string
  children: ReactNode
}) {
  // Держим в дереве на время анимации закрытия.
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) setMounted(true)
    else {
      const t = setTimeout(() => setMounted(false), 220)
      return () => clearTimeout(t)
    }
    return undefined
  }, [open])

  if (!mounted) return null
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div
        className="absolute inset-0"
        style={{
          background: 'var(--scrim)',
          opacity: open ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
        onClick={onClose}
      />
      <div
        className="relative flex min-h-0 flex-col overflow-hidden rounded-t-tile bg-bg"
        style={{
          height,
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 220ms cubic-bezier(0.3, 1, 0.4, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
