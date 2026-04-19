import React from 'react'
import { Text, View } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ScreenHeader } from '@/lib/ui/composed/ScreenHeader'
import { Section } from '@/lib/ui/composed/Section'
import { StatCard } from '@/lib/ui/composed/StatCard'
import { SegmentedControl } from '@/lib/ui/composed/SegmentedControl'

describe('ScreenHeader', () => {
  it('renders the title', () => {
    render(<ScreenHeader title="Axiom" />)
    expect(screen.getByText('Axiom')).toBeTruthy()
  })

  it('renders subtitle when provided', () => {
    render(<ScreenHeader title="Blindspot" subtitle="Under-covered stories." />)
    expect(screen.getByText('Under-covered stories.')).toBeTruthy()
  })

  it('renders leading slot', () => {
    render(
      <ScreenHeader
        title="Axiom"
        leading={<View testID="leading" />}
      />,
    )
    expect(screen.getByTestId('leading')).toBeTruthy()
  })

  it('renders all trailing nodes', () => {
    render(
      <ScreenHeader
        title="Axiom"
        trailing={[<View key="a" testID="t-a" />, <View key="b" testID="t-b" />]}
      />,
    )
    expect(screen.getByTestId('t-a')).toBeTruthy()
    expect(screen.getByTestId('t-b')).toBeTruthy()
  })
})

describe('Section', () => {
  it('renders the label and children', () => {
    render(
      <Section label="Spectrum">
        <Text>body</Text>
      </Section>,
    )
    expect(screen.getByText('Spectrum')).toBeTruthy()
    expect(screen.getByText('body')).toBeTruthy()
  })

  it('renders trailing slot', () => {
    render(
      <Section label="Spectrum" trailing={<View testID="trailing" />}>
        <Text>body</Text>
      </Section>,
    )
    expect(screen.getByTestId('trailing')).toBeTruthy()
  })
})

describe('StatCard', () => {
  it('renders the label', () => {
    render(<StatCard value={0} label="Stories Read" />)
    expect(screen.getByText('Stories Read')).toBeTruthy()
  })

  it('renders a static value when animated=false', () => {
    render(<StatCard value={42} label="Stories" animated={false} />)
    expect(screen.getByText('42')).toBeTruthy()
  })
})

describe('SegmentedControl', () => {
  const OPTIONS = [
    { value: 'name', label: 'A–Z' },
    { value: 'bias', label: 'Bias' },
  ] as const

  it('renders one pill per option', () => {
    render(
      <SegmentedControl
        value="name"
        onChange={jest.fn()}
        options={OPTIONS}
      />,
    )
    expect(screen.getByText('A–Z')).toBeTruthy()
    expect(screen.getByText('Bias')).toBeTruthy()
  })

  it('invokes onChange with the pressed option value', () => {
    const onChange = jest.fn()
    render(
      <SegmentedControl
        testID="seg"
        value="name"
        onChange={onChange}
        options={OPTIONS}
      />,
    )
    fireEvent.press(screen.getByTestId('seg-bias'))
    expect(onChange).toHaveBeenCalledWith('bias')
  })
})
