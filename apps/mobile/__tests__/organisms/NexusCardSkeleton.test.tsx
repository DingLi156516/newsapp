import React from 'react'
import { render } from '@testing-library/react-native'
import { NexusCardSkeleton, NexusCardSkeletonList } from '@/components/organisms/NexusCardSkeleton'

describe('NexusCardSkeleton', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<NexusCardSkeleton />)
    expect(toJSON()).not.toBeNull()
  })
})

describe('NexusCardSkeletonList', () => {
  it('renders the default 4 items', () => {
    const { toJSON } = render(<NexusCardSkeletonList />)
    const tree = toJSON()
    // The root View contains N skeleton children
    expect(tree).not.toBeNull()
    if (tree && !Array.isArray(tree)) {
      expect(tree.children).toHaveLength(4)
    }
  })

  it('renders N items when count is specified', () => {
    const { toJSON } = render(<NexusCardSkeletonList count={2} />)
    const tree = toJSON()
    expect(tree).not.toBeNull()
    if (tree && !Array.isArray(tree)) {
      expect(tree.children).toHaveLength(2)
    }
  })
})
