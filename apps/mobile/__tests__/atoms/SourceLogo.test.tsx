import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { SourceLogo } from '@/components/atoms/SourceLogo'

describe('SourceLogo', () => {
  it('renders favicon image when domain is provided', () => {
    render(<SourceLogo domain="reuters.com" name="Reuters" bias="center" />)
    const image = screen.getByTestId('source-logo-image')
    expect(image).toBeTruthy()
  })

  it('renders fallback when domain is undefined', () => {
    render(<SourceLogo name="Reuters" bias="center" />)
    expect(screen.getByTestId('source-logo-fallback')).toBeTruthy()
    expect(screen.getByText('R')).toBeTruthy()
  })

  it('renders fallback with first letter of name', () => {
    render(<SourceLogo name="BBC News" bias="left" />)
    expect(screen.getByText('B')).toBeTruthy()
  })

  it('applies custom size', () => {
    render(<SourceLogo domain="bbc.com" name="BBC" bias="center" size={60} />)
    const image = screen.getByTestId('source-logo-image')
    expect(image.props.style).toEqual(
      expect.objectContaining({ width: 60, height: 60, borderRadius: 18 })
    )
  })

  it('uses default size of 40', () => {
    render(<SourceLogo domain="bbc.com" name="BBC" bias="center" />)
    const image = screen.getByTestId('source-logo-image')
    expect(image.props.style).toEqual(
      expect.objectContaining({ width: 40, height: 40, borderRadius: 12 })
    )
  })
})
