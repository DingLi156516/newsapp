import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { StoryScores } from '@/components/molecules/StoryScores'

describe('StoryScores', () => {
  it('returns null when all scores are null', () => {
    const { toJSON } = render(
      <StoryScores impactScore={null} sourceDiversity={null} controversyScore={null} />
    )
    expect(toJSON()).toBeNull()
  })

  it('renders section title', () => {
    render(
      <StoryScores impactScore={75} sourceDiversity={null} controversyScore={null} />
    )
    expect(screen.getByText('Story Scores')).toBeTruthy()
  })

  it('renders only non-null scores', () => {
    render(
      <StoryScores impactScore={80} sourceDiversity={null} controversyScore={45} />
    )
    expect(screen.queryByText('Impact')).toBeNull()  // collapsed by default
  })
})
