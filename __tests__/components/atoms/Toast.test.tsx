import { render, screen } from '@testing-library/react'
import { Toast } from '@/components/atoms/Toast'

vi.mock('framer-motion')

describe('Toast', () => {
  it('renders message when visible', () => {
    render(<Toast message="Link copied!" visible={true} onDismiss={vi.fn()} />)
    expect(screen.getByText('Link copied!')).toBeInTheDocument()
  })

  it('does not render when not visible', () => {
    render(<Toast message="Link copied!" visible={false} onDismiss={vi.fn()} />)
    expect(screen.queryByText('Link copied!')).not.toBeInTheDocument()
  })

  it('calls onDismiss after duration', async () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<Toast message="Test" visible={true} onDismiss={onDismiss} duration={1000} />)
    vi.advanceTimersByTime(1000)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
