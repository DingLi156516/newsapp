/**
 * lib/api/auth-helpers.ts — Server-side auth utilities for API routes.
 *
 * Provides getAuthenticatedUser() for protected API endpoints.
 * Supports cookie-based auth (web) and Bearer token auth (mobile).
 */

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

interface AuthResult {
  readonly user: User | null
  readonly error: string | null
  readonly supabase: SupabaseClient<Database>
}

function getBearerToken(headerStore: Headers): string | null {
  const auth = headerStore.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export async function getAuthenticatedUser(): Promise<AuthResult> {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // Server Component context — safe to ignore.
            }
          }
        },
      },
    }
  )

  // Try cookie-based auth first (web app)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (user) {
    return { user, error: null, supabase }
  }

  // Fallback: Bearer token auth (mobile app)
  const headerStore = await headers()
  const token = getBearerToken(headerStore)
  if (token) {
    const tokenClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )
    const { data: { user: tokenUser }, error: tokenError } =
      await tokenClient.auth.getUser(token)

    if (tokenUser) {
      return { user: tokenUser, error: null, supabase: tokenClient }
    }
    return { user: null, error: tokenError?.message ?? 'Invalid token', supabase }
  }

  return {
    user: null,
    error: error?.message ?? null,
    supabase,
  }
}
