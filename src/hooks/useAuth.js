import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session)
      })
      .catch((err) => console.error('Supabase getSession failed:', err))
      .finally(() => {
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  function signIn() {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/gmail.send',
        redirectTo: window.location.origin,
      },
    })
  }

  function signOut() {
    return supabase.auth.signOut()
  }

  return { session, loading, signIn, signOut }
}
