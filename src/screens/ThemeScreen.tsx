// Экран «Оформление»: режим системная/светлая/тёмная и реестр тем.
// Карточка темы — миниатюра борда 120×90 в цветах самой темы (важно, читается
// ли борд, а не красивы ли цвета). Тап применяет тему сразу, без анимации.

import { useTheme, type ThemeMode, type ThemePrefs } from '../app/theme'
import { saveThemePrefs } from '../data/profileTheme'
import { DEFAULT_DARK_ID, DEFAULT_LIGHT_ID, THEMES } from '../domain/themes'
import type { Theme } from '../domain/types'
import { IconChevronLeft } from '../ui/icons'

const MODES: readonly { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'системная' },
  { mode: 'light', label: 'светлая' },
  { mode: 'dark', label: 'тёмная' },
]

export function ThemeScreen({ userId, onBack }: { userId: string; onBack: () => void }) {
  const { prefs, activeId, setPrefs } = useTheme()

  // Сначала применяем локально (мгновенно), запись в профиль догоняет фоном.
  const apply = (next: ThemePrefs) => {
    setPrefs(next)
    void saveThemePrefs(userId, next)
  }

  // Тёмная тема занимает слот «ночи», светлая — слот «дня»; режим не трогаем.
  const pickTheme = (t: Theme) =>
    apply(t.kind === 'dark' ? { ...prefs, darkId: t.id } : { ...prefs, lightId: t.id })

  const selectedIn = (t: Theme) => (t.kind === 'dark' ? prefs.darkId : prefs.lightId) === t.id

  const standard = THEMES.filter((t) => t.id === DEFAULT_DARK_ID || t.id === DEFAULT_LIGHT_ID)
  const unusual = THEMES.filter((t) => !standard.includes(t))

  const section = (title: string, list: readonly Theme[]) => (
    <div className="flex flex-col gap-2">
      <span className="text-13 text-text-muted">{title}</span>
      {list.map((t) => (
        <ThemeCard
          key={t.id}
          theme={t}
          selected={selectedIn(t)}
          active={t.id === activeId}
          onPick={() => pickTheme(t)}
        />
      ))}
    </div>
  )

  return (
    <div className="flex h-full flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex shrink-0 items-center gap-2 px-3 pt-1.5">
        <button
          type="button"
          aria-label="Назад"
          onClick={onBack}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-tile bg-surface text-text-muted"
        >
          <IconChevronLeft size={15} />
        </button>
        <h1 className="font-tile text-24 font-semibold leading-[1.1] text-text">Оформление</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="mt-3 grid grid-cols-3 gap-1" role="radiogroup" aria-label="Режим темы">
          {MODES.map(({ mode, label }) => {
            const active = prefs.mode === mode
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => apply({ ...prefs, mode })}
                className={`flex h-9 items-center justify-center rounded-tile text-13 ${
                  active ? 'bg-text font-medium text-bg' : 'bg-surface2 text-text'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {section('Стандартные', standard)}
          {section('Необычные', unusual)}
        </div>

        <p className="mt-3 text-11 text-text-quiet">Тап применяет тему сразу.</p>
      </div>
    </div>
  )
}

function ThemeCard({
  theme,
  selected,
  active,
  onPick,
}: {
  theme: Theme
  selected: boolean
  active: boolean
  onPick: () => void
}) {
  const note =
    (theme.kind === 'dark' ? 'тёмная' : 'светлая') + (active ? ' · сейчас на экране' : '')
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-tile bg-surface p-2.5 text-left"
    >
      <BoardMini t={theme} />
      <span className="min-w-0 flex-1">
        <span className="block text-15 text-text">{theme.name}</span>
        <span className="mt-[3px] block font-mono text-11 text-text-quiet">{note}</span>
      </span>
      {/* Выбранная в своей роли — закрашенный квадрат, не галочка */}
      <span
        aria-hidden
        className="h-3.5 w-3.5 shrink-0 rounded-tile border"
        style={
          selected
            ? { background: 'var(--text)', borderColor: 'var(--text)' }
            : { borderColor: 'var(--line)' }
        }
      />
    </button>
  )
}

// Миниатюра борда 120×90: цвета берутся из реестра темы напрямую (не из токенов),
// потому что рисуем чужую тему внутри текущей. Раскладка —
// плюс по одной slipped- и done-плитке, чтобы было видно все состояния.
function BoardMini({ t }: { t: Theme }) {
  const u = t.urgency
  return (
    <span
      aria-hidden
      className="box-border flex h-[90px] w-[120px] shrink-0 flex-col gap-[3px] rounded-tile p-[5px]"
      style={{ background: t.bg }}
    >
      <span className="flex gap-[3px]">
        <Cell flex={2} h={34} bg={u[3]} />
        <Cell flex={1} h={34} bg={u[2]} />
      </span>
      <span className="flex gap-[3px]">
        <Cell flex={1} h={20} bg={u[1]} />
        <Cell flex={1} h={20} bg={u[0]} />
        <Cell flex={1} h={20} bg={t.slipped.fill} />
      </span>
      <span className="flex gap-[3px]">
        <Cell flex={1} h={20} bg={u[2]} />
        <Cell flex={2} h={20} bg={t.done.fill} />
      </span>
    </span>
  )
}

function Cell({ flex, h, bg }: { flex: number; h: number; bg: string }) {
  return <span style={{ flex, height: h, background: bg, borderRadius: 1 }} />
}
