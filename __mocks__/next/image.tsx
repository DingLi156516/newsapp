import React from 'react'

interface MockImageProps {
  src: string
  alt: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  sizes?: string
  priority?: boolean
}

export default function MockImage({ src, alt, fill: _fill, ...props }: MockImageProps) {
  return <img src={src} alt={alt} {...props} />
}
