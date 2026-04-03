import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { KeyQuotesCarousel } from '@/components/organisms/KeyQuotesCarousel'

describe('KeyQuotesCarousel', () => {
  it('returns null for empty quotes', () => {
    const { toJSON } = render(<KeyQuotesCarousel quotes={[]} />)
    expect(toJSON()).toBeNull()
  })

  it('returns null for null quotes', () => {
    const { toJSON } = render(<KeyQuotesCarousel quotes={null as never} />)
    expect(toJSON()).toBeNull()
  })

  it('renders section title and quote text', () => {
    render(
      <KeyQuotesCarousel quotes={[
        { text: 'This is a key quote', sourceName: 'Reuters', sourceBias: 'center' },
      ]} />
    )
    expect(screen.getByText('Key Quotes')).toBeTruthy()
  })

  it('renders source name', () => {
    render(
      <KeyQuotesCarousel quotes={[
        { text: 'A notable quote', sourceName: 'AP News', sourceBias: 'center' },
      ]} />
    )
    expect(screen.getByText(/AP News/)).toBeTruthy()
  })
})
