/**
 * Tests for lib/auth/auth-provider.tsx — AuthProvider context and state management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { AuthProvider, AuthContext } from '@/lib/auth/auth-provider'
import { useContext } from 'react'

// Mock the Supabase browser client
const mockOnAuthStateChange = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignUp = vi.fn()
const mockSignInWithOAuth = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
    },
  })),
}))

function TestConsumer() {
  const context = useContext(AuthContext)
  if (!context) return <div>no context</div>
  return (
    <div>
      <span data-testid="loading">{String(context.isLoading)}</span>
      <span data-testid="user">{context.user?.email ?? 'none'}</span>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // onAuthStateChange fires INITIAL_SESSION synchronously with null session by default.
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      cb('INITIAL_SESSION', null)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
  })

  it('renders children and provides context', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('sets user from initial session via onAuthStateChange', async () => {
    const mockUser = { email: 'test@example.com', id: '123' }
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      cb('INITIAL_SESSION', { user: mockUser })
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('test@example.com')
    })
  })

  it('subscribes to auth state changes', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalledOnce()
    })
  })

  it('updates state when auth state changes', async () => {
    let authCallback: (event: string, session: unknown) => void = () => {}
    mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb
      // Fire INITIAL_SESSION synchronously, then allow later manual calls.
      cb('INITIAL_SESSION', null)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false')
    })

    const newUser = { email: 'new@example.com', id: '456' }
    act(() => {
      authCallback('SIGNED_IN', { user: newUser })
    })

    expect(screen.getByTestId('user').textContent).toBe('new@example.com')
  })

  it('unsubscribes on unmount', async () => {
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    })

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalled()
    })

    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('signInWithEmail calls supabase and returns error', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid credentials' },
    })

    let contextValue: ReturnType<typeof useContext<typeof AuthContext>> = null

    function Grabber() {
      contextValue = useContext(AuthContext)
      return null
    }

    render(
      <AuthProvider>
        <Grabber />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(contextValue?.isLoading).toBe(false)
    })

    const result = await contextValue!.signInWithEmail('a@b.com', 'wrong')
    expect(result.error).toBe('Invalid credentials')
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'wrong',
    })
  })

  it('signUpWithEmail calls supabase', async () => {
    mockSignUp.mockResolvedValue({ data: {}, error: null })

    let contextValue: ReturnType<typeof useContext<typeof AuthContext>> = null

    function Grabber() {
      contextValue = useContext(AuthContext)
      return null
    }

    render(
      <AuthProvider>
        <Grabber />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(contextValue?.isLoading).toBe(false)
    })

    const result = await contextValue!.signUpWithEmail('a@b.com', 'password123')
    expect(result.error).toBeNull()
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'password123',
    })
  })
})
