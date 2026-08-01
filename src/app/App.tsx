import { useState } from 'react'
import { ThemeProvider } from './theme'
import { demoMode, useSession } from './session'
import { supabaseConfigured } from '../data/supabase'
import { LoginScreen } from '../screens/LoginScreen'
import { TabBar, type Tab } from '../ui/TabBar'

export function App() {
  return (
    <ThemeProvider>
      <Gate />
    </ThemeProvider>
  )
}

function Gate() {
  const { session, loading } = useSession()

  if (loading) return <div className="h-dvh bg-bg" />
  if (!session && !demoMode) return <LoginScreen />
  return <Shell />
}

function Shell() {
  const [tab, setTab] = useState<Tab>('day')
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Placeholder tab={tab} />
      </main>
      <TabBar active={tab} onSelect={setTab} onAdd={() => setCreateOpen(true)} />
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'var(--scrim)' }}
          onClick={() => setCreateOpen(false)}
        >
          <div className="w-full rounded-tile bg-surface p-4 text-15 text-text-muted">
            Шторка создания появится в фазе 4
          </div>
        </div>
      )}
      {!supabaseConfigured && demoMode && (
        <div className="pointer-events-none fixed left-3 top-1 text-11 text-text-quiet">демо</div>
      )}
    </div>
  )
}

const TITLES: Record<Tab, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  stats: 'Статистика',
}

function Placeholder({ tab }: { tab: Tab }) {
  return (
    <div
      className="flex h-full items-center justify-center"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <span className="font-tile text-24 text-text-quiet">{TITLES[tab]}</span>
    </div>
  )
}
