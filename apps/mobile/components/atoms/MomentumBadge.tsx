/**
 * MomentumBadge — Narrative phase pill badge (Breaking, Developing, Analysis).
 * Returns null for 'aftermath' phase since it's not noteworthy.
 */

import { View, Text } from 'react-native'
import { BADGE } from '@/lib/shared/design'
import type { NarrativePhase } from '@/lib/shared/types'
import { PHASE_LABELS, PHASE_COLORS } from '@/lib/shared/types'

interface Props {
  readonly phase: NarrativePhase
}

export function MomentumBadge({ phase }: Props) {
  if (phase === 'aftermath') return null

  const color = PHASE_COLORS[phase]

  return (
    <View
      accessibilityLabel={`Story phase: ${PHASE_LABELS[phase]}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: `${color}20`,
        borderWidth: 0.5,
        borderColor: `${color}40`,
        borderRadius: BADGE.borderRadius,
        paddingHorizontal: BADGE.paddingH,
        paddingVertical: BADGE.paddingV,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{
        fontFamily: 'Inter-SemiBold',
        fontSize: 10,
        color,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {PHASE_LABELS[phase]}
      </Text>
    </View>
  )
}
