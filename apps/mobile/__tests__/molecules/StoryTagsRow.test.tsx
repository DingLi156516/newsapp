import React from 'react'
import { render, screen } from '@testing-library/react-native'

import { StoryTagsRow } from '@/components/molecules/StoryTagsRow'

describe('StoryTagsRow', () => {
  it('returns null for empty tags', () => {
    const { toJSON } = render(<StoryTagsRow tags={[]} />)
    expect(toJSON()).toBeNull()
  })

  it('renders tag labels', () => {
    render(
      <StoryTagsRow tags={[
        { slug: 'iran', label: 'Iran', type: 'location', storyCount: 50 },
        { slug: 'nato', label: 'NATO', type: 'organization', storyCount: 30 },
      ]} />
    )
    expect(screen.getByText('Iran')).toBeTruthy()
    expect(screen.getByText('NATO')).toBeTruthy()
  })
})
