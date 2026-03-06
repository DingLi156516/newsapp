/**
 * Tests for components/organisms/SuggestionsList.tsx
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SuggestionsList } from '@/components/organisms/SuggestionsList'
import { sampleArticles } from '@/lib/sample-data'

vi.mock('framer-motion')
vi.mock('next/image')
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/hooks/use-bookmarks', () => ({
  useBookmarks: () => ({
    isBookmarked: () => false,
    toggle: vi.fn(),
  }),
}))

describe('SuggestionsList', () => {
  it('shows loading skeleton when isLoading=true', () => {
    const { container } = render(
      <SuggestionsList suggestions={[]} isLoading={true} />
    )
    // NexusCardSkeletonList renders animated pulse elements
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows empty state message when suggestions=[]', () => {
    render(
      <SuggestionsList suggestions={[]} isLoading={false} />
    )
    expect(screen.getByText('Read more stories to get personalized suggestions!')).toBeInTheDocument()
  })

  it('renders NexusCards for each suggestion', () => {
    const suggestions = sampleArticles.slice(0, 2)
    render(
      <SuggestionsList suggestions={suggestions} isLoading={false} />
    )
    expect(screen.getByText(suggestions[0].headline)).toBeInTheDocument()
    expect(screen.getByText(suggestions[1].headline)).toBeInTheDocument()
  })

  it('renders cards in a grid layout', () => {
    const suggestions = sampleArticles.slice(0, 2)
    const { container } = render(
      <SuggestionsList suggestions={suggestions} isLoading={false} />
    )
    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
  })
})
