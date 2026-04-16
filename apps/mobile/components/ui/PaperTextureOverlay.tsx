/**
 * Full-screen tiled texture overlay driven by the active theme.
 *
 * Renders nothing when `theme.texture.kind !== 'grain'` (or no asset is
 * provided), so it's safe to mount unconditionally inside a themed shell.
 *
 * The overlay paints above app content but is non-interactive and hidden from
 * accessibility. It must be the first sibling above any modal screen content
 * since iOS modal presentations live in a separate view hierarchy that the
 * root shell overlay does not cover.
 */

import { Image, StyleSheet } from 'react-native'
import { useTheme } from '@/lib/shared/theme'

export function PaperTextureOverlay() {
  const theme = useTheme()
  if (theme.texture.kind !== 'grain' || !theme.texture.asset) return null
  return (
    <Image
      source={theme.texture.asset}
      resizeMode="repeat"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.overlay, { opacity: theme.texture.intensity }]}
    />
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
  },
})
