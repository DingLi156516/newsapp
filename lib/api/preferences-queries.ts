/**
 * lib/api/preferences-queries.ts — Supabase queries for user preferences.
 *
 * Handles fetching and updating user preferences, with auto-creation of
 * default preferences when none exist for a user.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

interface PreferencesRow {
  id: string
  user_id: string
  followed_topics: string[]
  default_region: string
  default_perspective: string
  factuality_minimum: string
  created_at: string
  updated_at: string
}

export async function queryPreferences(
  client: SupabaseClient<Database>,
  userId: string
): Promise<PreferencesRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('user_preferences') as any)
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code === 'PGRST116') {
    // No row found — auto-create with defaults
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error: insertError } = await (client.from('user_preferences') as any)
      .insert({ user_id: userId })
      .select('*')
      .single()

    if (insertError) {
      throw new Error(`Failed to create preferences: ${insertError.message}`)
    }
    return inserted
  }

  if (error) {
    throw new Error(`Failed to query preferences: ${error.message}`)
  }

  return data
}

export async function updatePreferences(
  client: SupabaseClient<Database>,
  userId: string,
  updates: Record<string, unknown>
): Promise<PreferencesRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from('user_preferences') as any)
    .update(updates)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to update preferences: ${error.message}`)
  }

  return data
}
