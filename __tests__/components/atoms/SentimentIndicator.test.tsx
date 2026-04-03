import { render, screen } from '@testing-library/react'
import { SentimentIndicator } from '@/components/atoms/SentimentIndicator'

describe('SentimentIndicator', () => {
  it('renders the sentiment label', () => {
    render(<SentimentIndicator sentiment="critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('renders with side-specific aria label', () => {
    render(<SentimentIndicator sentiment="hopeful" side="left" />)
    expect(screen.getByLabelText('left sentiment: Hopeful')).toBeInTheDocument()
  })

  it('renders without side in aria label', () => {
    render(<SentimentIndicator sentiment="angry" />)
    expect(screen.getByLabelText('Sentiment: Angry')).toBeInTheDocument()
  })

  it('renders all sentiment types', () => {
    const sentiments = ['angry', 'fearful', 'hopeful', 'neutral', 'critical', 'celebratory'] as const
    const labels = ['Angry', 'Fearful', 'Hopeful', 'Neutral', 'Critical', 'Celebratory']
    for (let i = 0; i < sentiments.length; i++) {
      const { unmount } = render(<SentimentIndicator sentiment={sentiments[i]} />)
      expect(screen.getByText(labels[i])).toBeInTheDocument()
      unmount()
    }
  })
})
