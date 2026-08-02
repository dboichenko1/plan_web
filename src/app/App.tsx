import { useEffect, useState, useSyncExternalStore } from 'react'
import { ThemeProvider } from './theme'
import { currentUserId, demoMode, useSession } from './session'
import { DesktopShell } from './DesktopShell'
import { useToday, todayIn } from './useToday'
import { LoginScreen } from '../screens/LoginScreen'
import { DayScreen, useSelectedDay } from '../screens/DayScreen'
import { WeekScreen } from '../screens/WeekScreen'
import { MonthScreen } from '../screens/MonthScreen'
import { PeriodScreen } from '../screens/PeriodScreen'
import { TaskCardSheet } from '../screens/TaskCardSheet'
import { CreateTaskSheet } from '../screens/CreateTaskSheet'
import { SettingsScreen } from '../screens/SettingsScreen'
import { NotificationsSettings } from '../screens/NotificationsSettings'
import { ThemeScreen } from '../screens/ThemeScreen'
import { TabBar, type Tab } from '../ui/TabBar'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import { seedDemo } from '../data/demoSeed'
import { startSync } from '../data/sync'
import { registerSW } from '../data/push'
import { addDays, isoWeekday } from '../domain/date'

export function App() {
  return (
    <ThemeProvider>
      <Gate />
    </ThemeProvider>
  )
}

function Gate() {
  const { session, loading } = useSession()
  const isDesktop = useIsDesktop()

  if (loading) return <div className="h-dvh bg-bg" />
  if (!session && !demoMode) return <LoginScreen />
  // От 1100px — раскладка мака (макет 21); мобильная оболочка ниже не меняется.
  if (isDesktop) return <DesktopShell userId={currentUserId(session)} />
  return <Shell userId={currentUserId(session)} />
}

// Раскладка мака включается от 1100px; подписка на matchMedia, чтобы смена
// ширины окна переключала оболочку без перезагрузки.
const DESKTOP_QUERY = '(min-width: 1100px)'

function subscribeDesktop(onChange: () => void): () => void {
  const mq = window.matchMedia(DESKTOP_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP_QUERY).matches)
}

function mondayOf(day: string): string {
  return addDays(day, 1 - isoWeekday(day))
}

function Shell({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>('day')
  const [createOpen, setCreateOpen] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [hangingOpen, setHangingOpen] = useState(false)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [settingsView, setSettingsView] = useState<null | 'settings' | 'notifications' | 'theme'>(null)

  const profile = useLive(() => db.profiles.get(userId), [userId])
  const timeZone = profile?.timezone ?? 'Europe/Warsaw'
  const today = useToday(timeZone)
  const [day, setDay] = useSelectedDay(today)
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayIn('Europe/Warsaw')))
  const [month, setMonth] = useState(() => todayIn('Europe/Warsaw').slice(0, 7))

  const [seeded, setSeeded] = useState(!demoMode)
  useEffect(() => {
    if (!demoMode) return
    seedDemo(todayIn('Europe/Warsaw')).then(() => setSeeded(true))
  }, [])

  useEffect(() => startSync(userId), [userId])
  useEffect(() => {
    void registerSW()
  }, [])

  const openDay = (d: string) => {
    setDay(d)
    setPeriodOpen(false)
    setTab('day')
  }

  const content = (() => {
    if (!seeded) return null
    if (settingsView === 'settings')
      return (
        <SettingsScreen
          userId={userId}
          today={today}
          onOpenNotifications={() => setSettingsView('notifications')}
          onOpenTheme={() => setSettingsView('theme')}
        />
      )
    if (settingsView === 'notifications')
      return <NotificationsSettings userId={userId} onBack={() => setSettingsView('settings')} />
    if (settingsView === 'theme')
      return <ThemeScreen userId={userId} onBack={() => setSettingsView('settings')} />
    if (periodOpen) return <PeriodScreen userId={userId} today={today} onOpenDay={openDay} />
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
      case 'week':
        return (
          <WeekScreen
            userId={userId}
            today={today}
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            onOpenDay={openDay}
            onOpenPeriod={() => setPeriodOpen(true)}
          />
        )
      case 'month':
        return (
          <MonthScreen
            userId={userId}
            today={today}
            month={month}
            onMonthChange={setMonth}
            onOpenDay={openDay}
          />
        )
      case 'stats':
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
          setPeriodOpen(false)
          setSettingsView(null)
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
