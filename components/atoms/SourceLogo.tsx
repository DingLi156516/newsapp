'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { BiasCategory } from '@/lib/types'
import { BIAS_COLOR } from '@/lib/types'

interface Props {
  domain?: string
  name: string
  bias: BiasCategory
  size?: number
  className?: string
}

export function SourceLogo({ domain, name, bias, size = 40, className = '' }: Props) {
  const [hasError, setHasError] = useState(false)

  const radius = Math.round(size * 0.3)
  const fontSize = Math.round(size * 0.4)

  if (!domain || hasError) {
    return (
      <div
        className={`flex items-center justify-center flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: `${BIAS_COLOR[bias]}25`,
        }}
        aria-label={`${name} logo`}
      >
        <span
          className="font-semibold text-white select-none"
          style={{ fontSize }}
        >
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden flex-shrink-0 ${className}`}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Image
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
        alt={`${name} logo`}
        width={size}
        height={size}
        className="object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  )
}
