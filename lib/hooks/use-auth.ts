/**
 * lib/hooks/use-auth.ts — Hook for accessing auth context.
 *
 * Must be used within an AuthProvider. Throws if used outside the provider tree.
 */

import { useContext } from 'react'
import { AuthContext } from '@/lib/auth/auth-provider'
import type { AuthContextValue } from '@/lib/auth/types'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
