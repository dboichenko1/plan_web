// Полоса ёмкости — индикатор прибора, не предупреждение. Считаются только
// живые задачи (ТЗ §5.8).

import { plural } from './format'

export function CapacityBar({ occupied, capacity }: { occupied: number; capacity: number }) {
  const over = occupied - capacity
  const ratio = capacity > 0 ? Math.min(1, occupied / capacity) : 1
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-11 text-text-muted">
          занято {occupied} из {capacity}
        </span>
        <span
          className="font-mono text-11"
          style={{ color: over > 0 ? 'var(--accent-alt)' : 'var(--text-quiet)' }}
        >
          {over > 0
            ? `перебор на ${over} ${plural(over, 'ячейку', 'ячейки', 'ячеек')}`
            : `${capacity - occupied} свободно`}
        </span>
      </div>
      <div className="mt-[5px] h-1 overflow-hidden rounded-tile bg-surface2">
        <div
          className="h-1"
          style={{
            width: `${ratio * 100}%`,
            background: over > 0 ? 'var(--accent-alt)' : 'var(--text-muted)',
            transition: 'width 200ms ease',
          }}
        />
      </div>
    </div>
  )
}
