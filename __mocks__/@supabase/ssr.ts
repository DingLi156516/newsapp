/**
 * __mocks__/@supabase/ssr.ts — Mock for @supabase/ssr browser and server clients.
 */

import { vi } from 'vitest'

const mockAuth = {
  getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  exchangeCodeForSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
  onAuthStateChange: vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  }),
}

const mockClient = {
  auth: mockAuth,
  from: vi.fn(),
}

export const createBrowserClient = vi.fn().mockReturnValue(mockClient)
export const createServerClient = vi.fn().mockReturnValue(mockClient)

export { mockAuth, mockClient }
