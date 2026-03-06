/**
 * lib/api/auth-helpers.ts — Server-side auth utilities for API routes.
 *
 * Provides getAuthenticatedUser() for protected API endpoints.
 * Creates a cookie-aware Supabase client and validates the user's JWT.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

interface AuthResult {
  readonly user: User | null
  readonly error: string | null
  readonly supabase: SupabaseClient<Database>
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

  const { data: { user }, error } = await supabase.auth.getUser()

  return {
    user: user ?? null,
    error: error?.message ?? null,
    supabase,
  }
}
