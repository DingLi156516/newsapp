/**
 * useOnline — Network connectivity hook using NetInfo.
 * Replaces web app's navigator.onLine + window events.
 */

import { useState, useEffect } from 'react'
import NetInfo from '@react-native-community/netinfo'

export function useOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true)
    })

    return () => unsubscribe()
  }, [])

  return isOnline
}
