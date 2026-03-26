/**
 * Supabase client for React Native.
 * Uses expo-secure-store for session persistence instead of cookies.
 */

import { createClient } from '@supabase/supabase-js'
import { ExpoSecureStoreAdapter } from '@/lib/supabase/secure-store-adapter'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
