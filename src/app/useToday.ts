import { useEffect, useState } from 'react'

// Сегодняшняя календарная дата в поясе пользователя. Пересчёт — таймер до
// ближайшей полуночи плюс visibilitychange: телефон почти всегда возвращается
// из фона, а не работает всю ночь (ТЗ §5.3).

export function todayIn(timeZone: string): string {
  // en-CA даёт ровно YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}

function msToNextMidnight(timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const elapsed = (get('hour') * 3600 + get('minute') * 60 + get('second')) * 1000
  // небольшой запас, чтобы проснуться уже в новых сутках
  return 24 * 3600 * 1000 - elapsed + 2000
}

export function useToday(timeZone: string): string {
  const [today, setToday] = useState(() => todayIn(timeZone))

  useEffect(() => {
    setToday(todayIn(timeZone))
    let timer: ReturnType<typeof setTimeout>
    const arm = () => {
      timer = setTimeout(() => {
        setToday(todayIn(timeZone))
        arm()
      }, msToNextMidnight(timeZone))
    }
    arm()
    const onVisible = () => {
      if (document.visibilityState === 'visible') setToday(todayIn(timeZone))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [timeZone])

  return today
}
