import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { SentimentPill } from '@/components/atoms/SentimentPill'

describe('SentimentPill', () => {
  it('renders label text for hopeful sentiment', () => {
    render(<SentimentPill sentiment="hopeful" />)
    expect(screen.getByText('Hopeful')).toBeTruthy()
  })

  it('renders label text for angry sentiment', () => {
    render(<SentimentPill sentiment="angry" />)
    expect(screen.getByText('Angry')).toBeTruthy()
  })

  it('has accessibility label', () => {
    render(<SentimentPill sentiment="critical" />)
    expect(screen.getByLabelText('Sentiment: Critical')).toBeTruthy()
  })
})
