import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'

/** Живой запрос к Dexie: перерисовка при любом изменении затронутых таблиц. */
export function useLive<T>(query: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const [value, setValue] = useState<T>()
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue })
    return () => sub.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return value
}
