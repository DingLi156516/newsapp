/**
 * SWR configuration provider with AppState + auth revalidation.
 * Replaces browser focus revalidation with React Native AppState.
 * Revalidates all caches when auth state changes (login/logout).
 */

import { useEffect, useCallback, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { SWRConfig, useSWRConfig } from 'swr'
import { fetcher } from '@/lib/hooks/fetcher'
import { useAuth } from '@/lib/hooks/use-auth'

function AppStateRevalidator() {
  const { mutate } = useSWRConfig()
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)

  const handleAppStateChange = useCallback(
    (nextState: AppStateStatus) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        mutate(() => true)
      }
      appStateRef.current = nextState
    },
    [mutate]
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange)
    return () => subscription.remove()
  }, [handleAppStateChange])

  return null
}

function AuthRevalidator() {
  const { user } = useAuth()
  const { mutate } = useSWRConfig()
  const prevUserId = useRef<string | null>(null)

  useEffect(() => {
    const currentId = user?.id ?? null
    if (currentId !== prevUserId.current) {
      prevUserId.current = currentId
      // Revalidate all SWR caches on login/logout
      mutate(() => true)
    }
  }, [user, mutate])

  return null
}

export function SWRProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 5000,
      }}
    >
      <AppStateRevalidator />
      <AuthRevalidator />
      {children}
    </SWRConfig>
  )
}
