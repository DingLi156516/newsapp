/**
 * OwnershipSummary (mobile) — above-the-fold ownership intelligence for a
 * story on the mobile detail screen. Mirror of web
 * components/organisms/OwnershipSummary.
 */

import { useMemo } from 'react'
import { View, Text } from 'react-native'
import { AlertTriangle, Building2, User } from 'lucide-react-native'
import type { NewsSource } from '@/lib/shared/types'
import { OWNER_TYPE_LABELS } from '@/lib/shared/types'
import { computeOwnershipDistribution } from '@/lib/shared/ownership-aggregator'
import { OwnershipBar } from '@/components/molecules/OwnershipBar'
import { GlassView } from '@/components/ui/GlassView'
import { useTheme } from '@/lib/shared/theme'

interface Props {
  readonly sources: readonly NewsSource[]
  /**
   * When true, the media_owners lookup failed upstream. Render a degraded
   * state so readers can tell an outage apart from stories that have no
   * known owners. Per Codex round-5 adversarial review.
   */
  readonly ownershipUnavailable?: boolean
}

const MIN_SOURCES = 3

export function OwnershipSummary({ sources, ownershipUnavailable }: Props) {
  const theme = useTheme()
  const distribution = useMemo(
    () => computeOwnershipDistribution(sources),
    [sources]
  )

  if (ownershipUnavailable) {
    return (
      <GlassView testID="ownership-summary" style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <AlertTriangle size={14} color="#fbbf24" style={{ marginTop: 2 }} />
          <Text
            style={{
              flex: 1,
              fontFamily: 'Inter',
              fontSize: 13,
              color: theme.text.secondary,
              lineHeight: 19,
            }}
          >
            Ownership data temporarily unavailable for this story.
          </Text>
        </View>
      </GlassView>
    )
  }

  if (sources.length < MIN_SOURCES) return null
  if (distribution.groups.length === 0) return null

  const total = sources.length
  const { dominantOwner, groups } = distribution

  const lead = groups[0]
  const headline = dominantOwner
    ? `${dominantOwner.ownerName} covers ${dominantOwner.sourceCount} of ${total} sources on this story.`
    : groups.length === 1
      ? `${groups[0].ownerName} is the only named owner among ${total} sources on this story.`
      : `Coverage spans ${groups.length} owners across ${total} sources on this story.`

  return (
    <GlassView
      testID="ownership-summary"
      style={{ padding: 12, gap: 8 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        {lead.isIndividual ? (
          <User size={14} color={theme.text.secondary} style={{ marginTop: 2 }} />
        ) : (
          <Building2 size={14} color={theme.text.secondary} style={{ marginTop: 2 }} />
        )}
        <Text
          style={{
            flex: 1,
            fontFamily: 'Inter',
            fontSize: 13,
            color: theme.text.primary,
            lineHeight: 19,
          }}
        >
          {headline}
        </Text>
      </View>
      <OwnershipBar distribution={distribution} totalSources={total} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {groups.slice(0, 4).map((group) => (
          <Text
            key={group.ownerId}
            style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.tertiary }}
          >
            <Text style={{ color: theme.text.secondary }}>{group.ownerName}</Text>
            {` · ${group.sourceCount} · ${OWNER_TYPE_LABELS[group.ownerType]}`}
          </Text>
        ))}
        {distribution.unknownCount > 0 && (
          <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.tertiary }}>
            {`${distribution.unknownCount} unknown`}
          </Text>
        )}
      </View>
    </GlassView>
  )
}
