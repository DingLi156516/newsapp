/**
 * Auth provider for React Native.
 * Same pattern as web app, using Supabase JS client instead of SSR client.
 */

import { createContext, useState, useEffect, useCallback, useMemo } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '@/lib/supabase/client'
import type { AuthContextValue } from '@/lib/auth/types'
import { readLocalBookmarks, clearLocalBookmarks } from '@/lib/hooks/use-local-bookmarks'
import { readLocalReadingHistory, clearLocalReadingHistory } from '@/lib/hooks/use-local-reading-history'
import { authFetch } from '@/lib/hooks/fetcher'

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession)
        setUser(newSession?.user ?? null)
        setIsLoading(false)

        // Merge local bookmarks and reading history to server on login
        if (newSession?.user) {
          const mergeBookmarks = async () => {
            const localIds = await readLocalBookmarks()
            if (localIds.size > 0) {
              const promises = [...localIds].map((storyId) =>
                authFetch('/api/bookmarks', {
                  method: 'POST',
                  body: JSON.stringify({ storyId }),
                })
              )
              await Promise.all(promises)
              await clearLocalBookmarks()
            }
          }

          const mergeReadingHistory = async () => {
            const localIds = await readLocalReadingHistory()
            if (localIds.size > 0) {
              const promises = [...localIds].map((storyId) =>
                authFetch(`/api/reading-history/${storyId}`, { method: 'POST' })
              )
              await Promise.all(promises)
              await clearLocalReadingHistory()
            }
          }

          try {
            await Promise.all([mergeBookmarks(), mergeReadingHistory()])
          } catch {
            // Merge failed — keep local data for next attempt
          }
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    try {
      const redirectTo = 'axiom://auth/callback'
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL

      if (!supabaseUrl) {
        return { error: 'Supabase URL not configured' }
      }

      // Build OAuth URL directly — bypasses Supabase client's Site URL config
      // which points to localhost and is unreachable from Expo Go on a phone.
      const authUrl =
        `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo)

      if (result.type !== 'success') {
        return { error: null } // user cancelled — not an error
      }

      // Extract tokens from the callback URL fragment
      const url = new URL(result.url)
      const fragment = new URLSearchParams(url.hash.slice(1))
      const accessToken = fragment.get('access_token')
      const refreshToken = fragment.get('refresh_token')

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        return { error: sessionError?.message ?? null }
      }

      return { error: 'No tokens received from OAuth callback' }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'OAuth failed' }
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
    }),
    [user, session, isLoading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
