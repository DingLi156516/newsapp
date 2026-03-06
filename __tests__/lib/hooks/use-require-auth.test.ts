/**
 * Tests for lib/hooks/use-require-auth.ts — Auth guard hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRequireAuth } from '@/lib/hooks/use-require-auth'

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/dashboard'),
}))

const mockUseAuth = vi.fn()
vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('useRequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false })

    renderHook(() => useRequireAuth())

    expect(mockReplace).toHaveBeenCalledWith('/login?redirect=%2Fdashboard')
  })

  it('does not redirect while loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })

    renderHook(() => useRequireAuth())

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does not redirect when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '123', email: 'test@example.com' },
      isLoading: false,
    })

    renderHook(() => useRequireAuth())

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('returns user and isLoading', () => {
    const mockUser = { id: '123', email: 'test@example.com' }
    mockUseAuth.mockReturnValue({ user: mockUser, isLoading: false })

    const { result } = renderHook(() => useRequireAuth())

    expect(result.current.user).toBe(mockUser)
    expect(result.current.isLoading).toBe(false)
  })

  it('returns isLoading true while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })

    const { result } = renderHook(() => useRequireAuth())

    expect(result.current.isLoading).toBe(true)
    expect(result.current.user).toBeNull()
  })
})
