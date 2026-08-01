import { useEffect, useMemo, useState } from 'react'
import { ThemeProvider } from './theme'
import { currentUserId, demoMode, useSession } from './session'
import { useToday } from './useToday'
import { LoginScreen } from '../screens/LoginScreen'
import { DayScreen, useSelectedDay } from '../screens/DayScreen'
import { TabBar, type Tab } from '../ui/TabBar'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import { seedDemo } from '../data/demoSeed'
import { todayIn } from './useToday'

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
  return <Shell userId={currentUserId(session)} />
}

function Shell({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>('day')
  const [createOpen, setCreateOpen] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [hangingOpen, setHangingOpen] = useState(false)

  const profile = useLive(() => db.profiles.get(userId), [userId])
  const timeZone = profile?.timezone ?? 'Europe/Warsaw'
  const today = useToday(timeZone)
  const [day, setDay] = useSelectedDay(today)

  const [seeded, setSeeded] = useState(!demoMode)
  useEffect(() => {
    if (!demoMode) return
    seedDemo(todayIn('Europe/Warsaw')).then(() => setSeeded(true))
  }, [])

  const content = useMemo(() => {
    if (!seeded) return null
    switch (tab) {
      case 'day':
        return (
          <DayScreen
            userId={userId}
            today={today}
            day={day}
            onDayChange={setDay}
            onOpenTask={setOpenTaskId}
            onOpenInbox={() => setInboxOpen(true)}
            hangingOpen={hangingOpen}
            onToggleHanging={() => setHangingOpen((v) => !v)}
          />
        )
      default:
        return <Placeholder tab={tab} />
    }
  }, [seeded, tab, userId, today, day, hangingOpen, setDay])

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <main className="min-h-0 flex-1">{content}</main>
      <TabBar active={tab} onSelect={setTab} onAdd={() => setCreateOpen(true)} />
      {createOpen && <ComingSoon onClose={() => setCreateOpen(false)} label="Шторка создания" />}
      {openTaskId && <ComingSoon onClose={() => setOpenTaskId(null)} label="Карточка задачи" />}
      {inboxOpen && <ComingSoon onClose={() => setInboxOpen(false)} label="Инбокс" />}
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
    <div className="flex h-full items-center justify-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <span className="font-tile text-24 text-text-quiet">{TITLES[tab]}</span>
    </div>
  )
}

function ComingSoon({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'var(--scrim)' }}
      onClick={onClose}
    >
      <div className="w-full rounded-t-tile bg-surface p-4 pb-10 text-15 text-text-muted">
        {label} — в следующей фазе
      </div>
    </div>
  )
}
