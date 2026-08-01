import { useEffect, useState } from 'react'
import { ThemeProvider } from './theme'
import { currentUserId, demoMode, useSession } from './session'
import { useToday } from './useToday'
import { LoginScreen } from '../screens/LoginScreen'
import { DayScreen, useSelectedDay } from '../screens/DayScreen'
import { TaskCardSheet } from '../screens/TaskCardSheet'
import { CreateTaskSheet } from '../screens/CreateTaskSheet'
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

  const content = (() => {
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
            inboxOpen={inboxOpen}
            onCloseInbox={() => setInboxOpen(false)}
            onToggleInbox={() => setInboxOpen((v) => !v)}
            hangingOpen={hangingOpen}
            onToggleHanging={() => setHangingOpen((v) => !v)}
          />
        )
      default:
        return <Placeholder tab={tab} />
    }
  })()

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <main className="relative min-h-0 flex-1">{content}</main>
      <TabBar
        active={tab}
        onSelect={(t) => {
          setInboxOpen(false)
          setTab(t)
        }}
        onAdd={() => setCreateOpen(true)}
      />
      <CreateTaskSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        userId={userId}
        today={today}
        defaultDay={tab === 'day' ? day : today}
      />
      {openTaskId && (
        <TaskCardSheet taskId={openTaskId} today={today} onClose={() => setOpenTaskId(null)} />
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
    <div className="flex h-full items-center justify-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <span className="font-tile text-24 text-text-quiet">{TITLES[tab]}</span>
    </div>
  )
}

