/**
 * Tests for components/molecules/ActiveOwnerChip.tsx
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ActiveOwnerChip,
  formatOwnerSlugForDisplay,
} from '@/components/molecules/ActiveOwnerChip'

describe('formatOwnerSlugForDisplay', () => {
  it('title-cases each hyphen-split token', () => {
    expect(formatOwnerSlugForDisplay('warner-bros-discovery')).toBe('Warner Bros Discovery')
  })

  it('handles single-token slugs', () => {
    expect(formatOwnerSlugForDisplay('bbc')).toBe('Bbc')
  })

  it('tolerates consecutive hyphens without crashing', () => {
    expect(formatOwnerSlugForDisplay('a--b')).toBe('A  B')
  })
})

describe('ActiveOwnerChip', () => {
  it('renders the formatted slug as display text', () => {
    render(<ActiveOwnerChip slug="warner-bros-discovery" onClear={() => undefined} />)
    expect(screen.getByText('Warner Bros Discovery')).toBeInTheDocument()
    expect(screen.getByTestId('active-owner-chip')).toBeInTheDocument()
  })

  it('prefers displayName when provided', () => {
    render(
      <ActiveOwnerChip
        slug="warner-bros-discovery"
        displayName="Warner Bros. Discovery"
        onClear={() => undefined}
      />
    )
    expect(screen.getByText('Warner Bros. Discovery')).toBeInTheDocument()
    expect(screen.queryByText('Warner Bros Discovery')).not.toBeInTheDocument()
  })

  it('invokes onClear when the × button is clicked', async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()
    render(<ActiveOwnerChip slug="fox-corporation" onClear={onClear} />)

    await user.click(screen.getByTestId('active-owner-chip-clear'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('exposes an aria-label on the clear button for screen readers', () => {
    render(<ActiveOwnerChip slug="dow-jones" onClear={() => undefined} />)
    expect(screen.getByLabelText(/clear owner filter dow jones/i)).toBeInTheDocument()
  })
})
