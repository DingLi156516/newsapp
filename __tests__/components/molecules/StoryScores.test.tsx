import { render, screen } from '@testing-library/react'
import { StoryScores } from '@/components/molecules/StoryScores'

vi.mock('framer-motion')

describe('StoryScores', () => {
  it('renders nothing when all scores are null', () => {
    const { container } = render(
      <StoryScores impactScore={null} sourceDiversity={null} controversyScore={null} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders impact score', () => {
    render(<StoryScores impactScore={75} />)
    expect(screen.getByText('Impact')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('renders all three scores for multi-source', () => {
    render(
      <StoryScores impactScore={60} sourceDiversity={4} controversyScore={0.8} sourceCount={3} />
    )
    expect(screen.getByText('Impact')).toBeInTheDocument()
    expect(screen.getByText('Source Diversity')).toBeInTheDocument()
    expect(screen.getByText('Controversy')).toBeInTheDocument()
  })

  it('hides diversity and controversy for single-source', () => {
    render(
      <StoryScores impactScore={30} sourceDiversity={1} controversyScore={0} sourceCount={1} />
    )
    expect(screen.getByText('Impact')).toBeInTheDocument()
    expect(screen.queryByText('Source Diversity')).not.toBeInTheDocument()
    expect(screen.queryByText('Controversy')).not.toBeInTheDocument()
  })

  it('renders the section heading', () => {
    render(<StoryScores impactScore={50} />)
    expect(screen.getByText('Story Scores')).toBeInTheDocument()
  })
})
