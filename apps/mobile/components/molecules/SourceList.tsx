import { useMemo, useState } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import type { NewsSource } from '@/lib/shared/types'
import { BiasTag } from '@/components/atoms/BiasTag'
import { FactualityBar } from '@/components/atoms/FactualityBar'
import { SourceLogo } from '@/components/atoms/SourceLogo'
import { Building2, ChevronDown, ChevronUp, ExternalLink, User } from 'lucide-react-native'
import { useTheme } from '@/lib/shared/theme'

interface SourceListProps {
  readonly sources: NewsSource[]
  readonly initialExpanded?: boolean
}

export function SourceList({ sources, initialExpanded = false }: SourceListProps) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const theme = useTheme()
  const visibleSources = expanded ? sources : sources.slice(0, 3)

  const ownerGroups = useMemo(() => {
    const groups = new Map<string, { name: string; isIndividual: boolean; count: number }>()
    for (const source of sources) {
      if (!source.owner) continue
      const existing = groups.get(source.owner.id)
      if (existing) {
        groups.set(source.owner.id, { ...existing, count: existing.count + 1 })
      } else {
        groups.set(source.owner.id, {
          name: source.owner.name,
          isIndividual: source.owner.isIndividual,
          count: 1,
        })
      }
    }
    return [...groups.values()].filter((g) => g.count >= 2)
  }, [sources])

  return (
    <View>
      {visibleSources.map((source) => (
        <Pressable
          key={source.id}
          onPress={() => {
            if (source.articleUrl) Linking.openURL(source.articleUrl)
            else if (source.url) Linking.openURL(`https://${source.url}`)
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
            paddingHorizontal: 4,
            opacity: pressed ? 0.7 : 1,
            borderBottomWidth: 0.5,
            borderBottomColor: theme.surface.border,
          })}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SourceLogo domain={source.url} name={source.name} bias={source.bias} size={24} />
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: theme.text.primary }}>
                {source.name}
              </Text>
              <BiasTag bias={source.bias} compact />
            </View>
            <FactualityBar level={source.factuality} size="compact" />
          </View>
          <ExternalLink size={14} color={theme.text.tertiary} />
        </Pressable>
      ))}
      {ownerGroups.length > 0 && (
        <View
          testID="source-list-owner-chips"
          style={{ paddingVertical: 8, gap: 4 }}
        >
          {ownerGroups.map((group) => (
            <View
              key={group.name}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              {group.isIndividual ? (
                <User size={12} color={theme.text.tertiary} />
              ) : (
                <Building2 size={12} color={theme.text.tertiary} />
              )}
              <Text style={{ fontFamily: 'Inter', fontSize: 11, color: theme.text.tertiary }}>
                {group.count} from {group.name}
              </Text>
            </View>
          ))}
        </View>
      )}
      {sources.length > 3 && (
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 }}
        >
          <Text style={{ fontFamily: 'Inter', fontSize: 12, color: theme.text.tertiary }}>
            {expanded ? 'Show less' : `Show all ${sources.length} sources`}
          </Text>
          {expanded ? (
            <ChevronUp size={14} color={theme.text.tertiary} />
          ) : (
            <ChevronDown size={14} color={theme.text.tertiary} />
          )}
        </Pressable>
      )}
    </View>
  )
}
