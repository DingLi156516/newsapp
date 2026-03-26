/**
 * useRequireAuth — Redirects to login if user is not authenticated.
 * Replaces Next.js middleware for mobile route protection.
 */

import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/hooks/use-auth'

export function useRequireAuth() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/(auth)/login')
    }
  }, [user, isLoading, router])

  return { user, isLoading }
}
