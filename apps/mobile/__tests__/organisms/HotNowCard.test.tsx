import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { HotNowCard } from '@/components/organisms/HotNowCard'

jest.mock('@/lib/hooks/use-hot-stories', () => ({
  useHotStories: jest.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useHotStories } = require('@/lib/hooks/use-hot-stories')
const mockHook = useHotStories as jest.Mock

describe('HotNowCard (mobile)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the section header always', () => {
    mockHook.mockReturnValue({ hotStories: [], isLoading: false, isError: false })
    render(<HotNowCard />)
    expect(screen.getByText('Hot Now')).toBeTruthy()
    expect(screen.getByText('last 6h')).toBeTruthy()
  })

  it('renders the empty-state copy when there are no hot stories', () => {
    mockHook.mockReturnValue({ hotStories: [], isLoading: false, isError: false })
    render(<HotNowCard />)
    expect(screen.getByTestId('hot-now-empty')).toBeTruthy()
  })

  it('renders one card per story with viewer count', () => {
    mockHook.mockReturnValue({
      hotStories: [
        {
          id: 'a',
          headline: 'Story A',
          imageUrl: null,
          uniqueViewers6h: 42,
        } as never,
        {
          id: 'b',
          headline: 'Story B',
          imageUrl: null,
          uniqueViewers6h: 7,
        } as never,
      ],
      isLoading: false,
      isError: false,
    })
    render(<HotNowCard />)
    expect(screen.getByTestId('hot-now-card-a')).toBeTruthy()
    expect(screen.getByTestId('hot-now-card-b')).toBeTruthy()
    expect(screen.getByText('42 reading')).toBeTruthy()
  })

  it('shows error fallback', () => {
    mockHook.mockReturnValue({ hotStories: [], isLoading: false, isError: true })
    render(<HotNowCard />)
    expect(screen.getByText(/Couldn't load hot stories/)).toBeTruthy()
  })
})
