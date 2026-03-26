/**
 * Tests for components/organisms/UserMenu.tsx — User menu states and interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenu } from '@/components/organisms/UserMenu'
import type { AuthContextValue } from '@/lib/auth/types'

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: mockRefresh,
    prefetch: vi.fn(),
  })),
}))

const mockUseAuth = vi.fn<() => Partial<AuthContextValue>>()
vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockUseAdmin = vi.fn<() => { isAdmin: boolean; isLoading: boolean }>()
vi.mock('@/lib/hooks/use-admin', () => ({
  useAdmin: () => mockUseAdmin(),
}))

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAdmin.mockReturnValue({ isAdmin: false, isLoading: false })
  })

  it('shows loading skeleton when auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true, signOut: vi.fn() })

    render(<UserMenu />)

    const skeleton = document.querySelector('.animate-shimmer')
    expect(skeleton).toBeInTheDocument()
  })

  it('shows sign-in button when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, signOut: vi.fn() })

    render(<UserMenu />)

    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('navigates to login page when sign-in button is clicked', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, signOut: vi.fn() })
    const user = userEvent.setup()

    render(<UserMenu />)

    await user.click(screen.getByText('Sign In'))
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('shows avatar with initial when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com', user_metadata: {} } as AuthContextValue['user'],
      isLoading: false,
      signOut: vi.fn(),
    })

    render(<UserMenu />)

    expect(screen.getByText('T')).toBeInTheDocument()
    expect(screen.getByLabelText('User menu')).toBeInTheDocument()
  })

  it('opens dropdown on avatar click', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com', user_metadata: {} } as AuthContextValue['user'],
      isLoading: false,
      signOut: vi.fn(),
    })

    render(<UserMenu />)

    await user.click(screen.getByLabelText('User menu'))

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
      expect(screen.getByText('Sign Out')).toBeInTheDocument()
    })
  })

  it('calls signOut and refreshes on sign out click', async () => {
    const mockSignOut = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com', user_metadata: {} } as AuthContextValue['user'],
      isLoading: false,
      signOut: mockSignOut,
    })

    render(<UserMenu />)

    await user.click(screen.getByLabelText('User menu'))
    await user.click(screen.getByText('Sign Out'))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledOnce()
      expect(mockRefresh).toHaveBeenCalledOnce()
    })
  })

  it('shows admin links when user is admin', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue({
      user: { email: 'admin@example.com', user_metadata: {} } as AuthContextValue['user'],
      isLoading: false,
      signOut: vi.fn(),
    })
    mockUseAdmin.mockReturnValue({ isAdmin: true, isLoading: false })

    render(<UserMenu />)

    await user.click(screen.getByLabelText('User menu'))

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument()
      expect(screen.getByText('Review Queue')).toBeInTheDocument()
      expect(screen.getByText('Pipeline')).toBeInTheDocument()
    })
  })

  it('does not show admin links when user is not admin', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue({
      user: { email: 'user@example.com', user_metadata: {} } as AuthContextValue['user'],
      isLoading: false,
      signOut: vi.fn(),
    })
    mockUseAdmin.mockReturnValue({ isAdmin: false, isLoading: false })

    render(<UserMenu />)

    await user.click(screen.getByLabelText('User menu'))

    await waitFor(() => {
      expect(screen.getByText('Sign Out')).toBeInTheDocument()
    })
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    expect(screen.queryByText('Review Queue')).not.toBeInTheDocument()
    expect(screen.queryByText('Pipeline')).not.toBeInTheDocument()
  })

  it('closes dropdown on outside click', async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com', user_metadata: {} } as AuthContextValue['user'],
      isLoading: false,
      signOut: vi.fn(),
    })

    render(
      <div>
        <div data-testid="outside">Outside</div>
        <UserMenu />
      </div>
    )

    await user.click(screen.getByLabelText('User menu'))
    expect(screen.getByText('test@example.com')).toBeInTheDocument()

    await user.click(screen.getByTestId('outside'))

    await waitFor(() => {
      expect(screen.queryByText('test@example.com')).not.toBeInTheDocument()
    })
  })
})
