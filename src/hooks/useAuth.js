import { useState, useEffect, useCallback } from 'react'
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

  // Get a fresh Google access token by refreshing the Supabase session
  const getAccessToken = useCallback(async () => {
    // First check if current session has a valid provider token
    if (session?.provider_token) return session.provider_token

    // Force a session refresh to get a new provider token
    const { data, error } = await supabase.auth.refreshSession()
    if (error) throw new Error('Session expired — please sign in again')
    if (data.session?.provider_token) {
      setSession(data.session)
      return data.session.provider_token
    }

    throw new Error('No access token — please sign in with Google')
  }, [session])

  return { session, loading, signIn, signOut, getAccessToken }
}
