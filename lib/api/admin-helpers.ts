/**
 * lib/api/admin-helpers.ts — Server-side admin auth utilities for API routes.
 *
 * Reuses getAuthenticatedUser() and checks admin_users table membership.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { getAuthenticatedUser } from '@/lib/api/auth-helpers'

interface AdminResult {
  readonly user: User | null
  readonly isAdmin: boolean
  readonly error: string | null
  readonly supabase: SupabaseClient<Database>
}

export async function getAdminUser(): Promise<AdminResult> {
  const { user, error, supabase } = await getAuthenticatedUser()

  if (error || !user) {
    return { user: null, isAdmin: false, error: error ?? 'Unauthorized', supabase }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('admin_users') as any)
    .select('id')
    .eq('user_id', user.id)
    .single()

  return {
    user,
    isAdmin: data !== null,
    error: null,
    supabase,
  }
}
