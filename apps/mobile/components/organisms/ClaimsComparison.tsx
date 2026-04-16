/**
 * ClaimsComparison — Collapsible list of key claims with dispute indicators.
 * Each claim shows a side badge (Left/Right/Both), disputed flag, and optional counter-claim.
 */

import { useState, useCallback } from 'react'
import { View, Text, Pressable } from 'react-native'
import { CollapsibleSection } from '@/components/molecules/CollapsibleSection'
import { SPACING } from '@/lib/shared/design'
import type { KeyClaim } from '@/lib/shared/types'
import { useTheme } from '@/lib/shared/theme'

interface Props {
  readonly claims: readonly KeyClaim[]
}

const SIDE_CONFIG: Record<string, { label: string; color: string }> = {
  left: { label: 'LEFT', color: '#60A5FA' },
  right: { label: 'RIGHT', color: '#F87171' },
  both: { label: 'BOTH', color: '#A1A1AA' },
}

function ClaimRow({ claim }: { claim: KeyClaim }) {
  const theme = useTheme()
  const [showCounter, setShowCounter] = useState(false)
  const side = SIDE_CONFIG[claim.side] ?? SIDE_CONFIG.both
  const warn = theme.semantic.warning

  const toggleCounter = useCallback(() => {
    setShowCounter((prev) => !prev)
  }, [])

  return (
    <View style={{ paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md }}>
      {/* Badges row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <View style={{
          borderWidth: 0.5,
          borderColor: `${side.color}40`,
          backgroundColor: `${side.color}18`,
          borderRadius: 9999,
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}>
          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 9, color: side.color, letterSpacing: 0.8 }}>
            {side.label}
          </Text>
        </View>
        {claim.disputed && (
          <View style={{
            borderWidth: 0.5,
            borderColor: warn.border,
            backgroundColor: warn.bg,
            borderRadius: 9999,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}>
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 9, color: warn.color, letterSpacing: 0.8 }}>
              DISPUTED
            </Text>
          </View>
        )}
      </View>

      {/* Claim text */}
      <Text style={{ fontFamily: 'Inter', fontSize: 13, lineHeight: 19, color: theme.text.primary }}>
        {claim.claim}
      </Text>

      {/* Counter-claim (expandable) */}
      {claim.counterClaim && (
        <>
          <Pressable
            onPress={toggleCounter}
            accessibilityRole="button"
            accessibilityState={{ expanded: showCounter }}
            style={{ marginTop: 6 }}
          >
            <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.tertiary }}>
              {showCounter ? 'Hide counter-claim' : 'Show counter-claim'}
            </Text>
          </Pressable>
          {showCounter && (
            <View style={{
              marginTop: 6,
              paddingLeft: 12,
              borderLeftWidth: 2,
              borderLeftColor: theme.surface.border,
            }}>
              <Text style={{ fontFamily: 'Inter', fontSize: 12, lineHeight: 18, color: theme.text.secondary }}>
                <Text style={{ fontFamily: 'Inter-SemiBold', color: theme.text.primary }}>Counter: </Text>
                {claim.counterClaim}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  )
}

export function ClaimsComparison({ claims }: Props) {
  if (!claims || claims.length === 0) return null

  const theme = useTheme()
  return (
    <CollapsibleSection
      title="Key Claims"
      subtitle={`${claims.length} claim${claims.length === 1 ? '' : 's'}`}
    >
      {/* Semantic prefix + index: KeyClaim has no id field and this list is static
         API data that never reorders, so index keys are safe for reconciliation. */}
      {(claims as KeyClaim[]).map((claim, i) => (
        <View
          key={`${claim.side}-${i}`}
          style={{
            borderBottomWidth: i < claims.length - 1 ? 0.5 : 0,
            borderBottomColor: theme.surface.border,
          }}
        >
          <ClaimRow claim={claim} />
        </View>
      ))}
    </CollapsibleSection>
  )
}
