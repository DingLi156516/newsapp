import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NexusCard } from '@/components/organisms/NexusCard'
import { sampleArticles } from '@/lib/sample-data'

vi.mock('framer-motion')
vi.mock('next/image')

const article = sampleArticles[0]

describe('NexusCard', () => {
  it('renders the article headline', () => {
    render(
      <NexusCard article={article} isSaved={false} onSave={vi.fn()} onClick={vi.fn()} />,
    )
    expect(screen.getByText(article.headline)).toBeInTheDocument()
  })

  it('renders CoverageCount with source count', () => {
    render(
      <NexusCard article={article} isSaved={false} onSave={vi.fn()} onClick={vi.fn()} />,
    )
    expect(screen.getByText(`${article.sourceCount} sources`)).toBeInTheDocument()
  })

  it('isBlindspot=true: renders BlindspotBadge', () => {
    const blindspotArticle = sampleArticles.find((a) => a.isBlindspot)!
    render(
      <NexusCard
        article={blindspotArticle}
        isSaved={false}
        onSave={vi.fn()}
        onClick={vi.fn()}
      />,
    )
    expect(screen.getByText('BLINDSPOT')).toBeInTheDocument()
  })

  it('isBlindspot=false: does NOT render BlindspotBadge', () => {
    const nonBlindspot = sampleArticles.find((a) => !a.isBlindspot)!
    render(
      <NexusCard
        article={nonBlindspot}
        isSaved={false}
        onSave={vi.fn()}
        onClick={vi.fn()}
      />,
    )
    expect(screen.queryByText('BLINDSPOT')).not.toBeInTheDocument()
  })

  it('clicking the card calls onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <NexusCard article={article} isSaved={false} onSave={vi.fn()} onClick={onClick} />,
    )
    await user.click(screen.getByRole('article'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('pressing Enter on the card calls onClick', () => {
    const onClick = vi.fn()
    render(
      <NexusCard article={article} isSaved={false} onSave={vi.fn()} onClick={onClick} />,
    )
    fireEvent.keyDown(screen.getByRole('article'), { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('pressing Space on the card calls onClick', () => {
    const onClick = vi.fn()
    render(
      <NexusCard article={article} isSaved={false} onSave={vi.fn()} onClick={onClick} />,
    )
    fireEvent.keyDown(screen.getByRole('article'), { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('isSaved=false: bookmark shows unsaved state', () => {
    render(
      <NexusCard article={article} isSaved={false} onSave={vi.fn()} onClick={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Bookmark story' })).toBeInTheDocument()
  })

  it('isSaved=true: bookmark shows saved state', () => {
    render(
      <NexusCard article={article} isSaved={true} onSave={vi.fn()} onClick={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Remove bookmark' })).toBeInTheDocument()
  })

  it('bookmark click calls onSave(article.id) and does not propagate to onClick', async () => {
    const onClick = vi.fn()
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(
      <NexusCard article={article} isSaved={false} onSave={onSave} onClick={onClick} />,
    )
    await user.click(screen.getByRole('button', { name: 'Bookmark story' }))
    expect(onSave).toHaveBeenCalledWith(article.id)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('isRead=true: renders "Read" pill badge', () => {
    render(
      <NexusCard article={article} isSaved={false} onSave={vi.fn()} onClick={vi.fn()} isRead />,
    )
    expect(screen.getByText('Read')).toBeInTheDocument()
  })

  it('isRead=true: headline has reduced opacity class', () => {
    render(
      <NexusCard article={article} isSaved={false} onSave={vi.fn()} onClick={vi.fn()} isRead />,
    )
    const headline = screen.getByText(article.headline)
    expect(headline.className).toContain('text-white/50')
  })

  it('isRead=false (default): no "Read" pill, full opacity headline', () => {
    render(
      <NexusCard article={article} isSaved={false} onSave={vi.fn()} onClick={vi.fn()} />,
    )
    expect(screen.queryByText('Read')).not.toBeInTheDocument()
    const headline = screen.getByText(article.headline)
    expect(headline.className).not.toContain('text-white/50')
  })
})
