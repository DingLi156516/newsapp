/**
 * lib/auth/types.ts — Auth state and context types.
 */

import type { User, Session } from '@supabase/supabase-js'

export interface AuthState {
  readonly user: User | null
  readonly session: Session | null
  readonly isLoading: boolean
}

export interface AuthContextValue extends AuthState {
  readonly signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  readonly signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  readonly signInWithGoogle: () => Promise<{ error: string | null }>
  readonly signOut: () => Promise<void>
}
