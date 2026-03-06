/**
 * Tests for components/molecules/ForYouCta.tsx
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForYouCta } from '@/components/molecules/ForYouCta'

describe('ForYouCta', () => {
  it('renders the personalization headline', () => {
    render(<ForYouCta onDismiss={vi.fn()} />)
    expect(screen.getByText('Personalize Your Feed')).toBeInTheDocument()
  })

  it('renders the description text', () => {
    render(<ForYouCta onDismiss={vi.fn()} />)
    expect(screen.getByText(/Sign in to get stories ranked/)).toBeInTheDocument()
  })

  it('renders Sign In link pointing to /login', () => {
    render(<ForYouCta onDismiss={vi.fn()} />)
    const link = screen.getByRole('link', { name: 'Sign In' })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('renders Maybe Later button', () => {
    render(<ForYouCta onDismiss={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Maybe Later' })).toBeInTheDocument()
  })

  it('calls onDismiss when Maybe Later is clicked', async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()
    render(<ForYouCta onDismiss={onDismiss} />)
    await user.click(screen.getByRole('button', { name: 'Maybe Later' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('has data-testid for integration testing', () => {
    render(<ForYouCta onDismiss={vi.fn()} />)
    expect(screen.getByTestId('for-you-cta')).toBeInTheDocument()
  })
})
