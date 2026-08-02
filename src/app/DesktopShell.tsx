// Раскладка мака (макеты 21–23): при ширине от 1100px вместо мобильной оболочки
// с таб-баром — шапка 56px с сегментами режима, слева панель инбокса 280px,
// по центру борд дня на 8 колонок, справа панель 320px с карточкой выбранной
// задачи. Месяц/неделя/статистика — без боковых панелей, по центру до 1100px.

import { useEffect, useState } from 'react'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import { seedDemo } from '../data/demoSeed'
import { startSync } from '../data/sync'
import { registerSW } from '../data/push'
import { demoMode } from './session'
import { useToday, todayIn } from './useToday'
import { addDays, isoWeekday } from '../domain/date'
import { effectiveUrgency } from '../domain/urgency'
import { DayScreen, useSelectedDay } from '../screens/DayScreen'
import { WeekScreen } from '../screens/WeekScreen'
import { MonthScreen } from '../screens/MonthScreen'
import { PeriodScreen } from '../screens/PeriodScreen'
import { InboxScreen } from '../screens/InboxScreen'
import { TaskCardSheet } from '../screens/TaskCardSheet'
import { CreateTaskSheet } from '../screens/CreateTaskSheet'
import type { Tab } from '../ui/TabBar'
import { dateLong, weekdayName } from '../ui/format'
import { IconPlus, IconSearch } from '../ui/icons'

const MODES: { id: Tab; label: string }[] = [
  { id: 'day', label: 'день' },
  { id: 'week', label: 'неделя' },
  { id: 'month', label: 'месяц' },
  { id: 'stats', label: 'статистика' },
]

const MODE_TITLES: Record<Tab, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  stats: 'Статистика',
}

function mondayOf(day: string): string {
  return addDays(day, 1 - isoWeekday(day))
}

export function DesktopShell({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>('day')
  const [createOpen, setCreateOpen] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [hangingOpen, setHangingOpen] = useState(false)
  const [periodOpen, setPeriodOpen] = useState(false)

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

  // Свёрнутые «Висят» в шапке — те же задачи, что и полоса внутри экрана дня.
  const hangingTasks = useLive(
    () =>
      db.tasks
        .where('scheduled_on')
        .below(today)
        .and((t) => t.user_id === userId && !t.deleted_at && t.status === 'open')
        .toArray(),
    [today, userId],
  )
  const hanging = (hangingTasks ?? []).sort(
    (a, b) => effectiveUrgency(b, today) - effectiveUrgency(a, today),
  )

  const openDay = (d: string) => {
    setDay(d)
    setPeriodOpen(false)
    setTab('day')
  }

  const title = tab === 'day' ? `${weekdayName(day)}, ${dateLong(day)}` : MODE_TITLES[tab]

  const wideContent = (() => {
    if (periodOpen) return <PeriodScreen userId={userId} today={today} onOpenDay={openDay} />
    switch (tab) {
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
      default:
        // Экраны статистики пишутся параллельно — здесь только заглушка.
        return (
          <div className="flex h-full items-center justify-center">
            <span className="font-tile text-24 text-text-quiet">Статистика</span>
          </div>
        )
    }
  })()

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
        <h1 className="font-tile text-18 font-semibold text-text">{title}</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-[2px]">
            {MODES.map((m) => {
              const active = tab === m.id && !periodOpen
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setPeriodOpen(false)
                    setTab(m.id)
                  }}
                  className={`flex h-[30px] items-center rounded-tile px-3.5 text-13 ${
                    active ? 'font-medium' : 'bg-surface text-text-muted'
                  }`}
                  style={active ? { background: 'var(--text)', color: 'var(--bg)' } : undefined}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
          {/* Поиск — пока заглушка-поле, без логики. */}
          <div className="flex h-[30px] w-[220px] items-center gap-2 rounded-tile border border-line bg-surface px-2.5">
            <span className="text-text-quiet">
              <IconSearch size={13} />
            </span>
            <span className="text-13 text-text-quiet">Найти задачу</span>
          </div>
          {tab === 'day' && hanging.length > 0 && (
            <button
              type="button"
              onClick={() => {
                // Полоса «Висят» раскрывается только на сегодняшнем дне.
                if (day !== today) setDay(today)
                setHangingOpen((v) => !v)
              }}
              className="flex h-[30px] items-center gap-2.5 rounded-tile bg-surface px-3"
            >
              <span className="text-13 text-text">Висят</span>
              <span className="font-mono text-13 text-text-muted">{hanging.length}</span>
              <span className="flex gap-[3px]">
                {hanging.slice(0, 4).map((t) => (
                  <span
                    key={t.id}
                    className="h-[5px] w-[5px]"
                    style={{ background: `var(--u${effectiveUrgency(t, today)})` }}
                  />
                ))}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex h-[30px] items-center gap-1.5 rounded-tile px-3.5 text-13 font-medium"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
          >
            <IconPlus size={14} />
            Задача
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {!seeded ? null : tab === 'day' ? (
          <>
            <aside className="flex w-[280px] shrink-0 flex-col border-r border-line">
              <div className="min-h-0 flex-1 overflow-hidden">
                <InboxScreen userId={userId} today={today} onOpenTask={setOpenTaskId} compact />
              </div>
              <div className="p-3 pt-1">
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-tile text-13 font-medium"
                  style={{ background: 'var(--text)', color: 'var(--bg)' }}
                >
                  <IconPlus size={14} />
                  Добавить задачу
                </button>
              </div>
            </aside>
            <main className="min-w-0 flex-1">
              <DayScreen
                userId={userId}
                today={today}
                day={day}
                onDayChange={setDay}
                onOpenTask={setOpenTaskId}
                cols={8}
                inboxOpen={false}
                onCloseInbox={() => {}}
                onToggleInbox={() => {}}
                hangingOpen={hangingOpen}
                onToggleHanging={() => setHangingOpen((v) => !v)}
              />
            </main>
            <aside className="w-[320px] shrink-0 overflow-hidden border-l border-line">
              {openTaskId ? (
                // key сбрасывает внутреннее состояние карточки (взвод удаления,
                // вопрос про серию) при выборе другой задачи.
                <TaskCardSheet
                  key={openTaskId}
                  embedded
                  taskId={openTaskId}
                  today={today}
                  onClose={() => setOpenTaskId(null)}
                />
              ) : (
                <EmptyCard />
              )}
            </aside>
          </>
        ) : (
          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto h-full max-w-[1100px]">{wideContent}</div>
          </main>
        )}
      </div>

      <CreateTaskSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        userId={userId}
        today={today}
        defaultDay={tab === 'day' ? day : today}
      />
    </div>
  )
}

function EmptyCard() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-15 text-text-muted">Задача не выбрана.</p>
      <p className="mt-1 text-13 text-text-quiet">
        Нажмите плитку на борде или строку в инбоксе.
      </p>
    </div>
  )
}
