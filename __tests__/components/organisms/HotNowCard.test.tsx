import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HotNowCard } from '@/components/organisms/HotNowCard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('framer-motion')

vi.mock('@/lib/hooks/use-hot-stories', () => ({
  useHotStories: vi.fn(),
}))

vi.mock('@/lib/hooks/use-bookmarks', () => ({
  useBookmarks: () => ({ isBookmarked: () => false, toggle: vi.fn() }),
}))

import { useHotStories } from '@/lib/hooks/use-hot-stories'
const mockHook = vi.mocked(useHotStories)

beforeEach(() => {
  vi.clearAllMocks()
})

const sampleStory = {
  id: 's1',
  headline: 'Sample',
  topic: 'politics',
  region: 'us',
  sourceCount: 3,
  isBlindspot: false,
  imageUrl: null,
  factuality: 'high',
  ownership: 'corporate',
  spectrumSegments: [{ bias: 'center', percentage: 100 }],
  aiSummary: { commonGround: '', leftFraming: '', rightFraming: '' },
  sources: [],
  uniqueViewers6h: 50,
  timestamp: '2026-04-22T00:00:00Z',
  storyVelocity: null,
  impactScore: null,
  sourceDiversity: null,
  controversyScore: null,
  sentiment: null,
  keyQuotes: null,
  keyClaims: null,
  headlines: [],
  ownershipUnavailable: false,
}

describe('HotNowCard', () => {
  it('renders the section header', () => {
    mockHook.mockReturnValue({ hotStories: [], isLoading: false, isError: false })
    render(<HotNowCard />)
    expect(screen.getByText('Hot Now')).toBeInTheDocument()
    expect(screen.getByText('last 6h')).toBeInTheDocument()
  })

  it('renders skeletons while loading', () => {
    mockHook.mockReturnValue({ hotStories: [], isLoading: true, isError: false })
    const { container } = render(<HotNowCard />)
    expect(container.querySelector('[data-testid="hot-now-section"]')).toBeInTheDocument()
  })

  it('renders empty-state copy when no engagement data', () => {
    mockHook.mockReturnValue({ hotStories: [], isLoading: false, isError: false })
    render(<HotNowCard />)
    expect(screen.getByText(/No engagement data yet/)).toBeInTheDocument()
  })

  it('renders error state when isError is true', () => {
    mockHook.mockReturnValue({ hotStories: [], isLoading: false, isError: true })
    render(<HotNowCard />)
    expect(screen.getByText(/Couldn't load hot stories/i)).toBeInTheDocument()
  })

  it('renders one card per hot story', () => {
    mockHook.mockReturnValue({
      hotStories: [
        { ...sampleStory, id: 'a', headline: 'A' } as never,
        { ...sampleStory, id: 'b', headline: 'B' } as never,
      ],
      isLoading: false,
      isError: false,
    })
    render(<HotNowCard />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})
