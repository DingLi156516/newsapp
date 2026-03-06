import { render, screen } from '@testing-library/react'
import { BiasTag } from '@/components/atoms/BiasTag'
import { BIAS_LABELS } from '@/lib/types'
import type { BiasCategory } from '@/lib/types'

const ALL_BIAS: BiasCategory[] = [
  'far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right',
]

describe('BiasTag', () => {
  it('renders title attribute equal to BIAS_LABELS[bias]', () => {
    render(<BiasTag bias="center" />)
    expect(screen.getByTitle(BIAS_LABELS['center'])).toBeInTheDocument()
  })

  it('all 7 bias values render without throwing', () => {
    ALL_BIAS.forEach((bias) => {
      expect(() => {
        const { unmount } = render(<BiasTag bias={bias} />)
        unmount()
      }).not.toThrow()
    })
  })

  it('label=false (default): does not render bias label text', () => {
    render(<BiasTag bias="left" />)
    expect(screen.queryByText(BIAS_LABELS['left'])).not.toBeInTheDocument()
  })

  it('label=true: renders the bias label text', () => {
    render(<BiasTag bias="right" label />)
    expect(screen.getByText(BIAS_LABELS['right'])).toBeInTheDocument()
  })

  it('has aria-label containing bias label', () => {
    render(<BiasTag bias="far-left" />)
    expect(screen.getByLabelText(`Bias: ${BIAS_LABELS['far-left']}`)).toBeInTheDocument()
  })
})
