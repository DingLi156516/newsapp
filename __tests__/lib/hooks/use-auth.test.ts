/**
 * Tests for lib/hooks/use-auth.ts — useAuth hook error boundary and context access.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAuth } from '@/lib/hooks/use-auth'
import { AuthContext } from '@/lib/auth/auth-provider'
import type { AuthContextValue } from '@/lib/auth/types'
import React from 'react'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when used outside AuthProvider', () => {
    // Suppress React error boundary console output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleSpy.mockRestore()
  })

  it('returns context value when used within AuthProvider', () => {
    const mockValue: AuthContextValue = {
      user: null,
      session: null,
      isLoading: false,
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    }

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AuthContext.Provider, { value: mockValue }, children)

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current).toBe(mockValue)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('returns authenticated user from context', () => {
    const mockUser = { id: '123', email: 'test@example.com' } as AuthContextValue['user']
    const mockValue: AuthContextValue = {
      user: mockUser,
      session: null,
      isLoading: false,
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    }

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AuthContext.Provider, { value: mockValue }, children)

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.user).toBe(mockUser)
    expect(result.current.user?.email).toBe('test@example.com')
  })

  it('exposes auth methods from context', () => {
    const mockValue: AuthContextValue = {
      user: null,
      session: null,
      isLoading: false,
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    }

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(AuthContext.Provider, { value: mockValue }, children)

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(typeof result.current.signInWithEmail).toBe('function')
    expect(typeof result.current.signUpWithEmail).toBe('function')
    expect(typeof result.current.signInWithGoogle).toBe('function')
    expect(typeof result.current.signOut).toBe('function')
  })
})
