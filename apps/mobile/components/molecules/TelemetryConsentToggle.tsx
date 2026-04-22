/**
 * TelemetryConsentToggle — surface for the engagement-capture opt-out.
 *
 * The toggle persists to AsyncStorage via `writeOptOut`. The story-detail
 * telemetry hook reads the same key on mount, so flipping the toggle is
 * effective from the next story open onward.
 */

import { useEffect, useState } from 'react'
import { View, Pressable } from 'react-native'
import { Shield } from 'lucide-react-native'
import { Heading, Text as UiText } from '@/lib/ui/primitives'
import { Surface } from '@/lib/ui/primitives/Surface'
import { useTheme } from '@/lib/shared/theme'
import { SPACING } from '@/lib/ui/tokens'
import { readOptOut, writeOptOut } from '@/lib/hooks/use-telemetry-consent'

export function TelemetryConsentToggle() {
  const theme = useTheme()
  const [optOut, setOptOut] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    readOptOut().then((value) => {
      if (!cancelled) {
        setOptOut(value)
        setReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  function handleToggle() {
    const next = !optOut
    setOptOut(next)
    void writeOptOut(next)
  }

  const enabled = !optOut

  return (
    <Surface
      testID="telemetry-consent-toggle-section"
      style={{ padding: SPACING.lg, gap: SPACING.sm + 2 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <Shield size={16} color={theme.text.primary} />
        <Heading variant="title">Anonymous Engagement</Heading>
      </View>
      <UiText variant="bodySm" tone="secondary">
        Share an opaque, weekly-rotating session id with stories you read so
        the feed can surface what other readers find interesting. No IP, no
        device id, no profile is built.
      </UiText>
      <Pressable
        testID="telemetry-consent-toggle"
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
        onPress={handleToggle}
        disabled={!ready}
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 9999,
          backgroundColor: enabled ? theme.surface.glassPill : 'transparent',
          borderWidth: 0.5,
          borderColor: theme.surface.borderPill,
          opacity: ready ? 1 : 0.5,
        }}
      >
        <UiText variant="bodySm" tone={enabled ? 'primary' : 'secondary'}>
          {enabled ? 'Sharing enabled' : 'Sharing disabled'}
        </UiText>
      </Pressable>
    </Surface>
  )
}
