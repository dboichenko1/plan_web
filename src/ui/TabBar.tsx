import type { ReactNode } from 'react'
import { IconPlus, IconTabDay, IconTabMonth, IconTabStats, IconTabWeek } from './icons'

export type Tab = 'day' | 'week' | 'month' | 'stats'

const TABS: { id: Tab; label: string; icon: (p: { size?: number }) => ReactNode }[] = [
  { id: 'day', label: 'день', icon: (p) => <IconTabDay {...p} /> },
  { id: 'week', label: 'неделя', icon: (p) => <IconTabWeek {...p} /> },
  { id: 'month', label: 'месяц', icon: (p) => <IconTabMonth {...p} /> },
  { id: 'stats', label: 'статистика', icon: (p) => <IconTabStats {...p} /> },
]

export function TabBar({
  active,
  onSelect,
  onAdd,
}: {
  active: Tab
  onSelect: (tab: Tab) => void
  onAdd: () => void
}) {
  const tab = (t: (typeof TABS)[number]) => (
    <button
      key={t.id}
      type="button"
      onClick={() => onSelect(t.id)}
      className={`flex flex-col items-center gap-1 py-1 ${active === t.id ? 'text-text' : 'text-text-quiet'}`}
    >
      {t.icon({ size: 22 })}
      <span className={`text-11 ${active === t.id ? 'font-medium' : ''}`}>{t.label}</span>
    </button>
  )
  return (
    <nav
      className="shrink-0 border-t border-line bg-surface px-3 pt-2"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
    >
      <div className="grid items-center" style={{ gridTemplateColumns: '1fr 1fr 64px 1fr 1fr' }}>
        {tab(TABS[0]!)}
        {tab(TABS[1]!)}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Добавить задачу"
            className="-mt-6 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-text text-bg"
          >
            <IconPlus size={22} />
          </button>
        </div>
        {tab(TABS[2]!)}
        {tab(TABS[3]!)}
      </div>
    </nav>
  )
}
