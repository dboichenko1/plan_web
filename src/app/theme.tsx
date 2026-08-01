import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_DARK_ID, DEFAULT_LIGHT_ID, themeById } from '../domain/themes'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemePrefs = { mode: ThemeMode; darkId: string; lightId: string }

// Ключи совпадают со встроенным скриптом в index.html — он ставит тему до первой
// отрисовки. Единственное место в приложении, где localStorage уместен.
const KEYS = { mode: 'theme_mode', dark: 'theme_dark_id', light: 'theme_light_id' } as const

function readPrefs(): ThemePrefs {
  const mode = localStorage.getItem(KEYS.mode)
  return {
    mode: mode === 'light' || mode === 'dark' ? mode : 'system',
    darkId: localStorage.getItem(KEYS.dark) ?? DEFAULT_DARK_ID,
    lightId: localStorage.getItem(KEYS.light) ?? DEFAULT_LIGHT_ID,
  }
}

export function resolveThemeId(prefs: ThemePrefs, prefersDark: boolean): string {
  const isDark = prefs.mode === 'dark' || (prefs.mode === 'system' && prefersDark)
  const id = isDark ? prefs.darkId : prefs.lightId
  return themeById(id) ? id : isDark ? DEFAULT_DARK_ID : DEFAULT_LIGHT_ID
}

function applyTheme(id: string) {
  document.documentElement.dataset.theme = id
  const bg = themeById(id)?.bg
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}

type ThemeContextValue = {
  prefs: ThemePrefs
  activeId: string
  setPrefs: (prefs: ThemePrefs) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState(readPrefs)
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const activeId = resolveThemeId(prefs, prefersDark)
  useEffect(() => applyTheme(activeId), [activeId])

  const setPrefs = useCallback((next: ThemePrefs) => {
    localStorage.setItem(KEYS.mode, next.mode)
    localStorage.setItem(KEYS.dark, next.darkId)
    localStorage.setItem(KEYS.light, next.lightId)
    setPrefsState(next)
  }, [])

  return (
    <ThemeContext.Provider value={{ prefs, activeId, setPrefs }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme вне ThemeProvider')
  return ctx
}
