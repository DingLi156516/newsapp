import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AISummaryTabs } from '@/components/organisms/AISummaryTabs'

vi.mock('framer-motion')

const props = {
  commonGround: 'Common ground content here',
  leftFraming: 'Left framing content here',
  rightFraming: 'Right framing content here',
}

describe('AISummaryTabs', () => {
  it('renders 3 tabs: "Common Ground", "Left ↗", "Right ↗"', () => {
    render(<AISummaryTabs {...props} />)
    expect(screen.getByRole('tab', { name: 'Common Ground' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Left ↗' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Right ↗' })).toBeInTheDocument()
  })

  it('default active tab is "Common Ground" with aria-selected="true"', () => {
    render(<AISummaryTabs {...props} />)
    expect(screen.getByRole('tab', { name: 'Common Ground' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Left ↗' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('default panel shows common ground content', () => {
    render(<AISummaryTabs {...props} />)
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Common ground content here')
  })

  it('clicking "Left ↗" shows left framing content', async () => {
    const user = userEvent.setup()
    render(<AISummaryTabs {...props} />)
    await user.click(screen.getByRole('tab', { name: 'Left ↗' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Left framing content here')
  })

  it('clicking "Right ↗" shows right framing content', async () => {
    const user = userEvent.setup()
    render(<AISummaryTabs {...props} />)
    await user.click(screen.getByRole('tab', { name: 'Right ↗' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Right framing content here')
  })

  it('clicking "Left ↗" sets its aria-selected to "true"', async () => {
    const user = userEvent.setup()
    render(<AISummaryTabs {...props} />)
    await user.click(screen.getByRole('tab', { name: 'Left ↗' }))
    expect(screen.getByRole('tab', { name: 'Left ↗' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Common Ground' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('tab has role="tab", panel has role="tabpanel"', () => {
    render(<AISummaryTabs {...props} />)
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByRole('tabpanel')).toBeInTheDocument()
  })

  it('tablist has aria-label', () => {
    render(<AISummaryTabs {...props} />)
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-label',
      'AI perspective summaries',
    )
  })

  describe('single-source mode (sourceCount=1)', () => {
    it('renders only 1 "Summary" tab', () => {
      render(<AISummaryTabs {...props} sourceCount={1} />)
      expect(screen.getByRole('tab', { name: 'Summary' })).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'Left ↗' })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'Right ↗' })).not.toBeInTheDocument()
    })

    it('shows common ground content in the Summary tab', () => {
      render(<AISummaryTabs {...props} sourceCount={1} />)
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Common ground content here')
    })

    it('has only 1 tab element', () => {
      render(<AISummaryTabs {...props} sourceCount={1} />)
      expect(screen.getAllByRole('tab')).toHaveLength(1)
    })

    it('uses "AI summary" aria-label', () => {
      render(<AISummaryTabs {...props} sourceCount={1} />)
      expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'AI summary')
    })
  })

  describe('multi-source mode (backward compat)', () => {
    it('renders 3 tabs when sourceCount is undefined', () => {
      render(<AISummaryTabs {...props} />)
      expect(screen.getAllByRole('tab')).toHaveLength(3)
    })

    it('renders 3 tabs when sourceCount > 1', () => {
      render(<AISummaryTabs {...props} sourceCount={5} />)
      expect(screen.getAllByRole('tab')).toHaveLength(3)
      expect(screen.getByRole('tab', { name: 'Common Ground' })).toBeInTheDocument()
    })
  })
})
