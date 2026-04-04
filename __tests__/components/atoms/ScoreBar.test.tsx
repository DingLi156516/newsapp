import { render, screen } from '@testing-library/react'
import { ScoreBar } from '@/components/atoms/ScoreBar'

vi.mock('framer-motion')

describe('ScoreBar', () => {
  it('renders the label and value', () => {
    render(<ScoreBar label="Impact" value={75} color="#8B5CF6" />)
    expect(screen.getByText('Impact')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('renders value with max suffix when max is not 100', () => {
    render(<ScoreBar label="Diversity" value={5} max={8} color="#3B82F6" />)
    expect(screen.getByText('5/8')).toBeInTheDocument()
  })

  it('renders decimal values with one decimal place', () => {
    render(<ScoreBar label="Controversy" value={0.7} max={1} color="#EF4444" />)
    expect(screen.getByText('0.7/1')).toBeInTheDocument()
  })

  it('renders integer values without decimal places', () => {
    render(<ScoreBar label="Impact" value={42} color="#8B5CF6" />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })
})
