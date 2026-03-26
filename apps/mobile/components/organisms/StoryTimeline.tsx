/**
 * StoryTimeline — Vertical timeline of coverage events.
 */

import { View, Text } from 'react-native'
import type { TimelineEvent } from '@/lib/shared/types'
import { BIAS_LABELS, BIAS_COLOR } from '@/lib/shared/types'
import { SpectrumBar } from '@/components/molecules/SpectrumBar'

interface Props {
  readonly events: readonly TimelineEvent[]
}

function formatEventTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function StoryTimeline({ events }: Props) {
  if (events.length === 0) return null

  return (
    <View style={{ paddingLeft: 16 }}>
      {events.map((event, index) => (
        <View key={event.id} style={{ flexDirection: 'row', gap: 12, paddingBottom: 16 }}>
          {/* Timeline line + dot */}
          <View style={{ width: 16, alignItems: 'center' }}>
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: BIAS_COLOR[event.sourceBias],
              opacity: 0.85,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.2)',
            }} />
            {index < events.length - 1 && (
              <View style={{
                width: 1,
                flex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                marginTop: 4,
              }} />
            )}
          </View>

          {/* Event content */}
          <View style={{ flex: 1, gap: 4, paddingTop: -2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: 'rgba(255, 255, 255, 0.9)' }}>
                {event.sourceName}
              </Text>
              <View style={{
                backgroundColor: BIAS_COLOR[event.sourceBias],
                opacity: 0.85,
                borderRadius: 9999,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}>
                <Text style={{
                  fontFamily: 'Inter',
                  fontSize: 9,
                  color: '#0A0A0A',
                }}>
                  {BIAS_LABELS[event.sourceBias]}
                </Text>
              </View>
            </View>
            <Text style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>
              {event.description}
            </Text>
            <Text style={{ fontFamily: 'Inter', fontSize: 10, color: 'rgba(255, 255, 255, 0.35)' }}>
              {formatEventTime(event.timestamp)} · {event.cumulativeSourceCount} sources
            </Text>
            {event.cumulativeSpectrum.length > 0 && (
              <View style={{ marginTop: 4 }}>
                <SpectrumBar segments={event.cumulativeSpectrum} height={4} />
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  )
}
