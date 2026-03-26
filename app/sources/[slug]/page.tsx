'use client'

import { use } from 'react'
import { SourceProfilePage } from '@/components/pages/SourceProfilePage'

interface Props {
  params: Promise<{ slug: string }>
}

export default function SourceProfileRoute({ params }: Props) {
  const { slug } = use(params)

  return <SourceProfilePage slug={slug} />
}
