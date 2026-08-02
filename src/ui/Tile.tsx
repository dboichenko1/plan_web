// Плитка — единственный объект интерфейса. Анатомия:
// сверху значок категории (и кольцо повтора), справа индикатор срочности,
// снизу заголовок и вторая строка (только на 2×2 и 4×2).

import type { CSSProperties } from 'react'
import type { Importance, TaskState, Urgency } from '../domain/types'
import { CategoryIcon, IconRepeatRing } from './icons'
import { hangingLabel } from './format'

export type TileData = {
  id: string
  title: string
  importance: Importance
  urgency: Urgency
  state: TaskState
  categoryIcon: string | null
  caption: string | null
  hangingDays: number
  repeating: boolean
}

const TITLE_SIZE: Record<Importance, string> = {
  1: 'text-13',
  2: 'text-15',
  3: 'text-18',
  4: 'text-24',
}

export function tileFill(t: Pick<TileData, 'state' | 'urgency'>): string {
  if (t.state === 'done') return 'var(--done-fill)'
  if (t.state === 'live') return `var(--u${t.urgency})`
  return 'var(--slipped-fill)'
}

export function tileTextColor(t: Pick<TileData, 'state' | 'urgency'>): string {
  if (t.state === 'done') return 'var(--done-text)'
  if (t.state === 'live') return `var(--on-u${t.urgency})`
  return 'var(--slipped-text)'
}

/** Квадратики индикатора: на серой плитке — исходный цвет срочности. */
function indicatorColor(t: Pick<TileData, 'state' | 'urgency'>): string {
  return t.state === 'live' ? `var(--on-u${t.urgency})` : `var(--u${t.urgency})`
}

export function Tile({ tile, style }: { tile: TileData; style?: CSSProperties }) {
  const expired = tile.state === 'expired'
  const gray = tile.state === 'slipped' || expired
  const color = tileTextColor(tile)
  // «Срок · категория» — только на 2×2 и 4×2; «N дней висит» — и на 2×1.
  const showCaption = gray ? tile.importance >= 2 : tile.importance >= 3
  const caption = gray
    ? tile.hangingDays > 0
      ? hangingLabel(tile.hangingDays)
      : null
    : tile.caption

  return (
    <div
      className="flex select-none flex-col justify-between overflow-hidden rounded-tile"
      style={{
        background: tileFill(tile),
        color,
        padding: expired ? 11 : 12,
        border: expired ? '1px solid var(--expired-outline)' : undefined,
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        ...style,
      }}
    >
      <div className="flex items-start justify-between">
        <span className="flex items-center gap-[5px]" style={{ opacity: tile.state === 'live' ? 0.85 : 0.8 }}>
          {tile.categoryIcon && <CategoryIcon icon={tile.categoryIcon} size={tile.importance >= 4 ? 16 : 15} />}
          {tile.repeating && <IconRepeatRing style={{ opacity: 0.9 }} />}
        </span>
        {tile.state !== 'done' && (
          <span className="flex gap-[2px]">
            {Array.from({ length: tile.urgency }, (_, i) => (
              <span key={i} className="h-1 w-1" style={{ background: indicatorColor(tile) }} />
            ))}
          </span>
        )}
      </div>
      <div className="min-h-0">
        <div
          className={`font-tile font-medium ${TITLE_SIZE[tile.importance]}`}
          style={{
            lineHeight: tile.importance === 4 ? 1.1 : tile.importance === 3 ? 1.15 : 1.2,
            ...(tile.importance <= 1
              ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
              : {
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }),
          }}
        >
          {tile.title}
        </div>
        {showCaption && caption && (
          <div
            className={gray ? 'font-mono text-11' : 'text-11'}
            style={{ opacity: gray ? 0.75 : 0.66, marginTop: tile.importance === 4 ? 5 : tile.importance === 3 ? 4 : 3 }}
          >
            {caption}
          </div>
        )}
      </div>
    </div>
  )
}
