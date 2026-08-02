// Уведомления (макет 17): два состояния одного экрана. iOS показывает окно
// разрешения только в ответ на нажатие кнопки — само оно не всплывёт (ТЗ §8).

import { useState } from 'react'
import { db } from '../data/db'
import { useLive } from '../data/hooks'
import { deletePushSubscription } from '../data/profile'
import { ensurePushSubscription, pushSupported } from '../data/push'
import { IconChevronLeft, IconClose } from '../ui/icons'
import { relativeTime } from '../ui/format'

export function NotificationsSettings({ userId, onBack }: { userId: string; onBack: () => void }) {
  const subs = useLive(
    () => db.push_subscriptions.filter((s) => s.user_id === userId).toArray(),
    [userId],
  )
  const [state, setState] = useState<'idle' | 'asking' | 'denied' | 'unsupported'>('idle')

  const subscribe = async () => {
    setState('asking')
    const result = await ensurePushSubscription(userId)
    setState(result === 'subscribed' ? 'idle' : result)
  }

  const hasSubs = (subs?.length ?? 0) > 0

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
        <h1 className="font-tile text-24 font-semibold text-text">Уведомления</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-4">
        {!hasSubs ? (
          <div className="pt-16 text-center">
            <p className="mx-auto max-w-[300px] text-15 text-text-muted">
              Напомним о задаче с временем — даже когда приложение закрыто.
            </p>
            <button
              type="button"
              onClick={() => void subscribe()}
              disabled={state === 'asking'}
              className="mt-5 h-11 rounded-tile bg-text px-5 text-15 font-medium text-bg disabled:opacity-60"
            >
              {state === 'asking' ? 'Спрашиваем…' : 'Разрешить уведомления'}
            </button>
            {state === 'denied' && (
              <p className="mt-3 text-13 text-text-quiet">
                Уведомления запрещены в настройках устройства. Разрешите их для этого
                приложения и попробуйте снова.
              </p>
            )}
            {(state === 'unsupported' || !pushSupported()) && state !== 'denied' && (
              <p className="mt-3 text-13 text-text-quiet">
                Пуши работают у приложения, установленного на домашний экран (iOS 16.4+).
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="mb-2.5 font-mono text-11 text-text-quiet">
              устройства с подпиской · {subs!.length}
            </p>
            <div className="flex flex-col gap-1">
              {subs!.map((s) => (
                <div
                  key={s.id}
                  className="flex h-14 items-center justify-between rounded-tile bg-surface px-3"
                >
                  <span>
                    <span className="block text-15 text-text">{s.device_label ?? 'Устройство'}</span>
                    <span className="block font-mono text-11 text-text-quiet">
                      заходили {relativeTime(s.last_seen_at)}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label="Отключить уведомления на устройстве"
                    onClick={() => void deletePushSubscription(userId, s.id)}
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-tile bg-surface2 text-text-muted"
                  >
                    <IconClose size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void subscribe()}
              className="mt-3 h-[34px] rounded-tile bg-surface2 px-4 text-13 text-text"
            >
              Подписать это устройство
            </button>
          </>
        )}
      </div>
    </div>
  )
}
