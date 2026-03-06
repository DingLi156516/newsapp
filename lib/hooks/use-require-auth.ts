/**
 * lib/hooks/use-require-auth.ts — Guard hook for protected client pages.
 *
 * Redirects unauthenticated users to /login with a redirect param.
 * Returns { user, isLoading } for conditional rendering.
 */

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'

export function useRequireAuth() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [user, isLoading, router, pathname])

  return { user, isLoading }
}
