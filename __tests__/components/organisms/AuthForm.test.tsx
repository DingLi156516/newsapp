/**
 * Tests for components/organisms/AuthForm.tsx — Form rendering, validation, submission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthForm } from '@/components/organisms/AuthForm'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('AuthForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnGoogleSignIn = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSubmit.mockResolvedValue({ error: null })
    mockOnGoogleSignIn.mockResolvedValue({ error: null })
  })

  it('renders login mode correctly', () => {
    render(
      <AuthForm
        mode="login"
        onSubmit={mockOnSubmit}
        onGoogleSignIn={mockOnGoogleSignIn}
      />
    )

    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Confirm password')).not.toBeInTheDocument()
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
    expect(screen.getByText('Sign up')).toBeInTheDocument()
  })

  it('renders signup mode with confirm password field', () => {
    render(
      <AuthForm
        mode="signup"
        onSubmit={mockOnSubmit}
        onGoogleSignIn={mockOnGoogleSignIn}
      />
    )

    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Confirm password')).toBeInTheDocument()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup()

    render(
      <AuthForm
        mode="login"
        onSubmit={mockOnSubmit}
        onGoogleSignIn={mockOnGoogleSignIn}
      />
    )

    await user.type(screen.getByPlaceholderText('Email address'), 'invalid')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    })
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('shows validation error for short password', async () => {
    const user = userEvent.setup()

    render(
      <AuthForm
        mode="login"
        onSubmit={mockOnSubmit}
        onGoogleSignIn={mockOnGoogleSignIn}
      />
    )

    await user.type(screen.getByPlaceholderText('Email address'), 'user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    })
  })

  it('shows validation error for mismatched passwords in signup', async () => {
    const user = userEvent.setup()

    render(
      <AuthForm
        mode="signup"
        onSubmit={mockOnSubmit}
        onGoogleSignIn={mockOnGoogleSignIn}
      />
    )

    await user.type(screen.getByPlaceholderText('Email address'), 'user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.type(screen.getByPlaceholderText('Confirm password'), 'different456')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })
  })

  it('calls onSubmit with valid login data', async () => {
    const user = userEvent.setup()

    render(
      <AuthForm
        mode="login"
        onSubmit={mockOnSubmit}
        onGoogleSignIn={mockOnGoogleSignIn}
      />
    )

    await user.type(screen.getByPlaceholderText('Email address'), 'user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('user@example.com', 'password123')
    })
  })

  it('displays server error from onSubmit', async () => {
    mockOnSubmit.mockResolvedValue({ error: 'Invalid login credentials' })
    const user = userEvent.setup()

    render(
      <AuthForm
        mode="login"
        onSubmit={mockOnSubmit}
        onGoogleSignIn={mockOnGoogleSignIn}
      />
    )

    await user.type(screen.getByPlaceholderText('Email address'), 'user@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
    })
  })

  it('calls onGoogleSignIn when Google button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <AuthForm
        mode="login"
        onSubmit={mockOnSubmit}
        onGoogleSignIn={mockOnGoogleSignIn}
      />
    )

    await user.click(screen.getByText('Continue with Google'))

    expect(mockOnGoogleSignIn).toHaveBeenCalledOnce()
  })

  it('displays success message when provided', () => {
    render(
      <AuthForm
        mode="signup"
        onSubmit={mockOnSubmit}
        onGoogleSignIn={mockOnGoogleSignIn}
        successMessage="Check your email to confirm your account."
      />
    )

    expect(screen.getByText('Check your email to confirm your account.')).toBeInTheDocument()
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()

    render(
      <AuthForm
        mode="login"
        onSubmit={mockOnSubmit}
        onGoogleSignIn={mockOnGoogleSignIn}
      />
    )

    const passwordInput = screen.getByPlaceholderText('Password')
    expect(passwordInput).toHaveAttribute('type', 'password')

    await user.click(screen.getByLabelText('Show password'))
    expect(passwordInput).toHaveAttribute('type', 'text')

    await user.click(screen.getByLabelText('Hide password'))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})
