import { useState, type FormEvent } from 'react'
import { supabase, supabaseConfigured } from '../data/supabase'

// Фон — тихая композиция из плиток четырёх цветов: экран за секунду
// объясняет, как выглядит продукт.
const BACKDROP: { span?: number; rows?: number; u: 1 | 2 | 3 | 4 }[] = [
  { span: 4, rows: 2, u: 4 },
  { span: 2, u: 1 },
  { u: 3 },
  { u: 2 },
  { span: 2, rows: 2, u: 3 },
  { span: 2, u: 2 },
  { u: 1 },
  { u: 4 },
  { span: 4, u: 1 },
  { span: 2, rows: 2, u: 2 },
  { span: 2, u: 4 },
  { u: 3 },
  { u: 1 },
  { span: 3, u: 1 },
  { u: 2 },
]

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [codeState, setCodeState] = useState<'idle' | 'checking' | 'error'>('idle')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !email.trim()) return
    setState('sending')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // На GitHub Pages приложение живёт на подпути — origin недостаточно.
      options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
    })
    if (err) {
      setError(
        err.code === 'over_email_send_rate_limit'
          ? 'Почта отправляет максимум два письма в час — лимит исчерпан. Подождите час или войдите по коду из прежнего письма.'
          : 'Не удалось отправить ссылку. Проверьте адрес и попробуйте ещё раз.',
      )
      setState('error')
    } else {
      setState('sent')
    }
  }

  // Вход по коду из письма: на iPhone ссылка открывается в Safari, а у
  // приложения с домашнего экрана хранилище своё — код решает это.
  async function verifyCode() {
    if (!supabase || code.trim().length < 6) return
    setCodeState('checking')
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    if (err) setCodeState('error')
    // при успехе сессию подхватит onAuthStateChange — экран сменится сам
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-bg">
      <div
        className="pointer-events-none absolute inset-0 grid gap-1 p-3 opacity-[0.17]"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '89px' }}
      >
        {BACKDROP.map((t, i) => (
          <div
            key={i}
            className={`rounded-tile bg-u${t.u}`}
            style={{
              gridColumn: t.span ? `span ${t.span}` : undefined,
              gridRow: t.rows ? `span ${t.rows}` : undefined,
            }}
          />
        ))}
      </div>
      <div
        className="relative flex flex-1 flex-col px-6 pb-6"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 44px)' }}
      >
        <div className="mt-[150px]">
          <h1 className="font-tile text-32 font-semibold leading-[1.1] text-text">Планировщик</h1>
          <p className="mt-2.5 max-w-[300px] text-15 text-text-muted">
            День — это не список, а картина. Чем важнее задача, тем больше её плитка.
          </p>
        </div>
        <form className="mt-auto flex flex-col gap-2" onSubmit={submit}>
          {!supabaseConfigured ? (
            <p className="text-13 text-text-muted">
              Не задано окружение Supabase. Впишите VITE_SUPABASE_URL и
              VITE_SUPABASE_PUBLISHABLE_KEY в .env и пересоберите.
            </p>
          ) : state === 'sent' ? (
            <div className="flex flex-col gap-2">
              <p className="text-15 text-text">
                Письмо ушло на {email.trim()}. Откройте ссылку на этом устройстве —
                или введите код из письма:
              </p>
              <div className="flex gap-1">
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Код из письма"
                  className="h-12 min-w-0 flex-1 rounded-tile border border-line bg-surface px-3.5 font-mono text-15 text-text placeholder:font-ui placeholder:text-text-quiet focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void verifyCode()}
                  disabled={codeState === 'checking' || code.trim().length < 6}
                  className="h-12 shrink-0 rounded-tile bg-text px-4 text-15 font-medium text-bg disabled:opacity-60"
                >
                  {codeState === 'checking' ? 'Проверяем…' : 'Войти'}
                </button>
              </div>
              {codeState === 'error' && (
                <p className="text-11 text-text-quiet">
                  Код не подошёл. Проверьте цифры или запросите новое письмо.
                </p>
              )}
            </div>
          ) : (
            <>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Почта"
                className="h-12 rounded-tile border border-line bg-surface px-3.5 text-15 text-text placeholder:text-text-quiet focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={state === 'sending'}
                className="flex h-12 items-center justify-center rounded-tile bg-text text-15 font-medium text-bg disabled:opacity-60"
              >
                {state === 'sending' ? 'Отправляем…' : 'Войти по ссылке на почту'}
              </button>
              <p className="mt-1 text-11 text-text-quiet">
                {state === 'error' ? error : 'Пришлём ссылку — пароль не нужен'}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (email.trim()) setState('sent')
                }}
                className="self-start text-13 text-accent"
              >
                Есть код из письма?
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
