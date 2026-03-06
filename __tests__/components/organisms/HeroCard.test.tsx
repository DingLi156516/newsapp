import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HeroCard } from '@/components/organisms/HeroCard'
import type { NewsArticle } from '@/lib/types'

vi.mock('framer-motion')
vi.mock('next/image')

const article: NewsArticle = {
  id: 'hero-1',
  headline: 'Test Hero Headline',
  topic: 'politics',
  sourceCount: 47,
  isBlindspot: false,
  imageUrl: 'https://example.com/image.jpg',
  factuality: 'high',
  ownership: 'corporate',
  sources: [],
  spectrumSegments: [
    { bias: 'left', percentage: 40 },
    { bias: 'center', percentage: 20 },
    { bias: 'right', percentage: 40 },
  ],
  aiSummary: { commonGround: '', leftFraming: '', rightFraming: '' },
  timestamp: new Date().toISOString(),
  region: 'us',
}

const articleNoImage: NewsArticle = {
  ...article,
  id: 'hero-2',
  imageUrl: null,
}

describe('HeroCard', () => {
  const onClick = vi.fn()
  const onSave = vi.fn()

  beforeEach(() => {
    onClick.mockClear()
    onSave.mockClear()
  })

  it('renders the headline', () => {
    render(<HeroCard article={article} onClick={onClick} onSave={onSave} isSaved={false} />)
    expect(screen.getByText('Test Hero Headline')).toBeInTheDocument()
  })

  it('renders source count badge', () => {
    render(<HeroCard article={article} onClick={onClick} onSave={onSave} isSaved={false} />)
    expect(screen.getByText(/47/)).toBeInTheDocument()
  })

  it('renders spectrum bar with labels', () => {
    render(<HeroCard article={article} onClick={onClick} onSave={onSave} isSaved={false} />)
    const labels = screen.getAllByText('40%')
    expect(labels).toHaveLength(2)
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    render(<HeroCard article={article} onClick={onClick} onSave={onSave} isSaved={false} />)
    await user.click(screen.getByRole('article'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders without image when imageUrl is null', () => {
    render(<HeroCard article={articleNoImage} onClick={onClick} onSave={onSave} isSaved={false} />)
    expect(screen.getByText('Test Hero Headline')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: '' })).not.toBeInTheDocument()
  })

  it('renders blindspot badge when isBlindspot is true', () => {
    const blindspotArticle = { ...article, isBlindspot: true }
    render(<HeroCard article={blindspotArticle} onClick={onClick} onSave={onSave} isSaved={false} />)
    expect(screen.getByText('BLINDSPOT')).toBeInTheDocument()
  })

  it('isRead=true: renders "Read" pill and dimmed headline', () => {
    render(<HeroCard article={article} onClick={onClick} onSave={onSave} isSaved={false} isRead />)
    expect(screen.getByText('Read')).toBeInTheDocument()
    const headline = screen.getByText('Test Hero Headline')
    expect(headline.className).toContain('text-white/50')
  })

  it('isRead=false: no "Read" pill', () => {
    render(<HeroCard article={article} onClick={onClick} onSave={onSave} isSaved={false} />)
    expect(screen.queryByText('Read')).not.toBeInTheDocument()
  })
})
