import React from 'react'
import { render, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { useContext } from 'react'

const mockSignInWithPassword = jest.fn()
const mockSignUp = jest.fn()
const mockSignOut = jest.fn()
const mockSetSession = jest.fn()
const mockOnAuthStateChange = jest.fn()
const mockOpenAuthSessionAsync = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      setSession: (...args: unknown[]) => mockSetSession(...args),
    },
  },
}))

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}))

const SUPABASE_URL = 'https://test.supabase.co'

// Set env var before importing the module
beforeAll(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = SUPABASE_URL
})

import { AuthProvider, AuthContext } from '@/lib/auth/auth-provider'
import type { AuthContextValue } from '@/lib/auth/types'

function TestConsumer() {
  const ctx = useContext(AuthContext)
  if (!ctx) return <Text>no context</Text>
  return (
    <>
      <Text testID="loading">{String(ctx.isLoading)}</Text>
      <Text testID="user">{ctx.user?.email ?? 'none'}</Text>
    </>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      cb('INITIAL_SESSION', null)
      return { data: { subscription: { unsubscribe: jest.fn() } } }
    })
  })

  it('provides auth context to children', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('loading').props.children).toBe('false')
    })
    expect(screen.getByTestId('user').props.children).toBe('none')
  })

  it('signInWithGoogle opens browser with manually constructed OAuth URL', async () => {
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'axiom://auth/callback#access_token=abc123&refresh_token=def456',
    })
    mockSetSession.mockResolvedValue({ error: null })

    let ctx: AuthContextValue | null = null
    function Grabber() {
      ctx = useContext(AuthContext)
      return null
    }

    render(
      <AuthProvider>
        <Grabber />
      </AuthProvider>
    )

    await waitFor(() => expect(ctx?.isLoading).toBe(false))

    const result = await ctx!.signInWithGoogle()

    // Should use the Supabase URL directly, NOT signInWithOAuth
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent('axiom://auth/callback')}`,
      'axiom://auth/callback'
    )
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'abc123',
      refresh_token: 'def456',
    })
    expect(result.error).toBeNull()
  })

  it('signInWithGoogle returns null error when user cancels', async () => {
    mockOpenAuthSessionAsync.mockResolvedValue({ type: 'cancel' })

    let ctx: AuthContextValue | null = null
    function Grabber() {
      ctx = useContext(AuthContext)
      return null
    }

    render(
      <AuthProvider>
        <Grabber />
      </AuthProvider>
    )

    await waitFor(() => expect(ctx?.isLoading).toBe(false))

    const result = await ctx!.signInWithGoogle()
    expect(result.error).toBeNull()
  })

  it('signInWithGoogle extracts tokens from URL hash fragment', async () => {
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'axiom://auth/callback#access_token=tok_abc&refresh_token=tok_ref&token_type=bearer',
    })
    mockSetSession.mockResolvedValue({ error: null })

    let ctx: AuthContextValue | null = null
    function Grabber() {
      ctx = useContext(AuthContext)
      return null
    }

    render(
      <AuthProvider>
        <Grabber />
      </AuthProvider>
    )

    await waitFor(() => expect(ctx?.isLoading).toBe(false))

    await ctx!.signInWithGoogle()

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'tok_abc',
      refresh_token: 'tok_ref',
    })
  })
})
