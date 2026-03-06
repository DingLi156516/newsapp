/**
 * lib/supabase/server.ts — Server-side Supabase clients.
 *
 * Three clients available:
 *   - getSupabaseServerClient(): Uses anon key, respects RLS (for API routes serving public data)
 *   - getSupabaseServiceClient(): Uses service role key, bypasses RLS (for cron/ingestion workers)
 *   - getSupabaseAuthClient(): Cookie-aware server client for auth (middleware, server components)
 *
 * Each call creates a fresh client — no caching on server (avoids cross-request leaks).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const fetchWithNoCache: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' })

export function getSupabaseServerClient(): SupabaseClient<Database> {
  return createClient<Database>(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { global: { fetch: fetchWithNoCache } }
  )
}

export function getSupabaseServiceClient(): SupabaseClient<Database> {
  return createClient<Database>(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { global: { fetch: fetchWithNoCache } }
  )
}

export async function getSupabaseAuthClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
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
              // setAll is called from Server Components where cookies can't be set.
              // This is safe to ignore when reading the session.
            }
          }
        },
      },
    }
  )
}
