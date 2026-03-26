'use client'

import { use } from 'react'
import { SourceComparisonPage } from '@/components/pages/SourceComparisonPage'

interface Props {
  searchParams: Promise<{ left?: string; right?: string }>
}

export default function SourceComparisonRoute({ searchParams }: Props) {
  const params = use(searchParams)

  return (
    <SourceComparisonPage
      leftSlug={typeof params.left === 'string' ? params.left : null}
      rightSlug={typeof params.right === 'string' ? params.right : null}
    />
  )
}
