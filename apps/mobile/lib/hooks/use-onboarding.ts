/**
 * useOnboarding — Checks/sets whether the user has seen the onboarding flow.
 */

import { useEffect, useState, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'hasSeenOnboarding'

export function useOnboarding() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((value) => {
      setHasSeenOnboarding(value === 'true')
    })
  }, [])

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(KEY, 'true')
    setHasSeenOnboarding(true)
  }, [])

  return { hasSeenOnboarding, completeOnboarding }
}
