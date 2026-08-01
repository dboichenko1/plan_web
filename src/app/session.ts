import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../data/supabase'

/** Демо-режим: интерфейс без входа и сети, данные только локальные (разработка). */
export const demoMode = import.meta.env.VITE_DEMO === '1'
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000'

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, loading }
}

export function currentUserId(session: Session | null): string {
  return session?.user.id ?? DEMO_USER_ID
}
