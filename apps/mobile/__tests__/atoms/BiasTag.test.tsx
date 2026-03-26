import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { BiasTag } from '@/components/atoms/BiasTag'
import { ALL_BIASES, BIAS_LABELS } from '@/lib/shared/types'
import type { BiasCategory } from '@/lib/shared/types'

describe('BiasTag', () => {
  it.each(ALL_BIASES)('renders label for bias "%s"', (bias: BiasCategory) => {
    render(<BiasTag bias={bias} />)
    expect(screen.getByText(BIAS_LABELS[bias])).toBeTruthy()
  })

  it('renders in compact mode with smaller text', () => {
    render(<BiasTag bias="center" compact />)
    expect(screen.getByText('Center')).toBeTruthy()
  })

  it.each(ALL_BIASES)('has accessibility label for bias "%s"', (bias: BiasCategory) => {
    render(<BiasTag bias={bias} />)
    expect(screen.getByLabelText(`${BIAS_LABELS[bias]} bias`)).toBeTruthy()
  })
})
