'use client'

import { use } from 'react'
import { OwnerProfilePage } from '@/components/pages/OwnerProfilePage'

interface Props {
  params: Promise<{ slug: string }>
}

export default function OwnerProfileRoute({ params }: Props) {
  const { slug } = use(params)

  return <OwnerProfilePage slug={slug} />
}
