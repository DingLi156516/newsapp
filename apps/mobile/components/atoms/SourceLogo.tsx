/**
 * SourceLogo — Displays a source's favicon from Google's service,
 * with a bias-colored first-letter fallback when the image fails or
 * no domain is provided.
 */

import { useState } from 'react'
import { View, Text } from 'react-native'
import { Image } from 'expo-image'
import type { BiasCategory } from '@/lib/shared/types'
import { BIAS_COLOR } from '@/lib/shared/types'

interface Props {
  /** Domain used to fetch favicon (e.g. "nytimes.com"). When undefined, renders fallback immediately. */
  readonly domain?: string
  /** Source name — first character used for the fallback avatar. */
  readonly name: string
  /** Bias category — determines fallback background tint. */
  readonly bias: BiasCategory
  /** Pixel size for width and height. Defaults to 40. */
  readonly size?: number
}

function FallbackAvatar({ name, bias, size }: { readonly name: string; readonly bias: BiasCategory; readonly size: number }) {
  const color = BIAS_COLOR[bias]
  return (
    <View
      testID="source-logo-fallback"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: `${color}40`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: 'Inter-Bold', fontSize: size * 0.42, color: '#fff' }}>
        {name.charAt(0)}
      </Text>
    </View>
  )
}

export function SourceLogo({ domain, name, bias, size = 40 }: Props) {
  const [hasError, setHasError] = useState(false)

  if (!domain || hasError) {
    return <FallbackAvatar name={name} bias={bias} size={size} />
  }

  return (
    <Image
      testID="source-logo-image"
      source={{ uri: `https://www.google.com/s2/favicons?domain=${domain}&sz=128` }}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
      }}
      contentFit="cover"
      onError={() => setHasError(true)}
    />
  )
}
