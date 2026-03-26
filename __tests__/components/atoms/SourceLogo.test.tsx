import { render, screen, fireEvent } from '@testing-library/react'
import { SourceLogo } from '@/components/atoms/SourceLogo'

describe('SourceLogo', () => {
  it('renders favicon image when domain is provided', () => {
    render(<SourceLogo domain="reuters.com" name="Reuters" bias="center" />)
    const img = screen.getByAltText('Reuters logo')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute(
      'src',
      expect.stringContaining('reuters.com')
    )
  })

  it('renders fallback when domain is undefined', () => {
    render(<SourceLogo name="Reuters" bias="center" />)
    expect(screen.getByText('R')).toBeInTheDocument()
    expect(screen.getByLabelText('Reuters logo')).toBeInTheDocument()
  })

  it('renders fallback on image error', () => {
    render(<SourceLogo domain="broken.com" name="Broken" bias="left" />)
    const img = screen.getByAltText('Broken logo')
    fireEvent.error(img)
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('applies custom size', () => {
    render(<SourceLogo name="BBC" bias="center" size={60} />)
    const fallback = screen.getByLabelText('BBC logo')
    expect(fallback).toHaveStyle({ width: '60px', height: '60px' })
  })

  it('uses default size of 40', () => {
    render(<SourceLogo name="BBC" bias="center" />)
    const fallback = screen.getByLabelText('BBC logo')
    expect(fallback).toHaveStyle({ width: '40px', height: '40px' })
  })
})
