import { render, screen } from '@testing-library/react'
import { GuideLink } from '@/components/atoms/GuideLink'

describe('GuideLink', () => {
  it('renders a link with HelpCircle icon', () => {
    render(<GuideLink section="factuality" />)
    const link = screen.getByLabelText('Learn more')
    expect(link).toBeInTheDocument()
  })

  it('links to correct /guide#section', () => {
    render(<GuideLink section="bias-spectrum" />)
    const link = screen.getByLabelText('Learn more')
    expect(link).toHaveAttribute('href', '/guide#bias-spectrum')
  })

  it('links to factuality section', () => {
    render(<GuideLink section="factuality" />)
    const link = screen.getByLabelText('Learn more')
    expect(link).toHaveAttribute('href', '/guide#factuality')
  })
})
