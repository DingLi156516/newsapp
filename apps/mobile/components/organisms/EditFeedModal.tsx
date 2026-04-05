/**
 * EditFeedModal — Full-screen modal for customizing visible feed tabs and sort order.
 * Now includes a TRENDING TOPICS section for hiding/showing promoted tags.
 */

import { View, Text, ScrollView, Pressable, Switch, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { FeedSort, UnifiedTab, StoryTag } from '@/lib/shared/types'
import type { FeedConfig } from '@/lib/hooks/use-feed-config'
import {
  ALL_FEED_TABS, ALL_TOPICS, FEED_TAB_LABELS, TOPIC_LABELS,
  FEED_SORT_LABELS, TAG_TYPE_COLORS,
} from '@/lib/shared/types'
import { GlassView } from '@/components/ui/GlassView'

interface Props {
  readonly visible: boolean
  readonly onClose: () => void
  readonly visibleFeeds: readonly UnifiedTab[]
  readonly feedSort: FeedSort
  readonly hiddenPromotedTags: readonly string[]
  readonly promotedTags?: readonly StoryTag[]
  readonly onUpdateConfig: (updates: Partial<FeedConfig>) => void
}

const SORT_OPTIONS: FeedSort[] = ['most-covered', 'most-recent']

export function EditFeedModal({ visible, onClose, visibleFeeds, feedSort, hiddenPromotedTags, promotedTags, onUpdateConfig }: Props) {
  const visibleSet = new Set<string>(visibleFeeds)
  const enabledCount = visibleSet.size
  const hiddenSet = new Set<string>(hiddenPromotedTags)

  const tagKey = (slug: string, type: string) => `${slug}:${type}`

  const toggleFeed = (tab: UnifiedTab) => {
    const isEnabled = visibleSet.has(tab)
    if (isEnabled && enabledCount <= 1) return // prevent disabling last tab

    const updated = isEnabled
      ? visibleFeeds.filter((t) => t !== tab)
      : [...visibleFeeds, tab]
    onUpdateConfig({ visibleFeeds: updated })
  }

  const togglePromotedTag = (slug: string, type: string) => {
    const key = tagKey(slug, type)
    const isHidden = hiddenSet.has(key)
    const updated = isHidden
      ? hiddenPromotedTags.filter((s) => s !== key)
      : [...hiddenPromotedTags, key]
    onUpdateConfig({ hiddenPromotedTags: updated })
  }

  const setSortOrder = (sort: FeedSort) => {
    onUpdateConfig({ feedSort: sort })
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 24, color: 'white' }}>
              Edit Feed
            </Text>
            <Pressable testID="edit-feed-done" onPress={onClose} hitSlop={8}>
              <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 15, color: 'white' }}>
                Done
              </Text>
            </Pressable>
          </View>

          {/* Feeds section */}
          <GlassView style={{ padding: 16, gap: 12 }}>
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: 1 }}>
              FEEDS
            </Text>
            {ALL_FEED_TABS.map((tab) => {
              const isEnabled = visibleSet.has(tab)
              return (
                <View key={tab} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: 'Inter', fontSize: 15, color: 'white' }}>
                    {FEED_TAB_LABELS[tab]}
                  </Text>
                  <Switch
                    testID={`edit-feed-toggle-${tab}`}
                    value={isEnabled}
                    onValueChange={() => toggleFeed(tab)}
                    disabled={isEnabled && enabledCount <= 1}
                    trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: 'rgba(255, 255, 255, 0.3)' }}
                    thumbColor="white"
                  />
                </View>
              )
            })}
          </GlassView>

          {/* Topics section */}
          <GlassView style={{ padding: 16, gap: 12 }}>
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: 1 }}>
              TOPICS
            </Text>
            {ALL_TOPICS.map((topic) => {
              const isEnabled = visibleSet.has(topic)
              return (
                <View key={topic} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: 'Inter', fontSize: 15, color: 'white' }}>
                    {TOPIC_LABELS[topic]}
                  </Text>
                  <Switch
                    testID={`edit-feed-toggle-${topic}`}
                    value={isEnabled}
                    onValueChange={() => toggleFeed(topic)}
                    disabled={isEnabled && enabledCount <= 1}
                    trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: 'rgba(255, 255, 255, 0.3)' }}
                    thumbColor="white"
                  />
                </View>
              )
            })}
          </GlassView>

          {/* Trending topics section */}
          {promotedTags && promotedTags.length > 0 && (
            <GlassView style={{ padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: 1 }}>
                  TRENDING TOPICS
                </Text>
                <Text style={{ fontFamily: 'Inter', fontSize: 11, color: 'rgba(255, 255, 255, 0.25)' }}>
                  auto-detected
                </Text>
              </View>
              {promotedTags.map((tag) => {
                const isEnabled = !hiddenSet.has(tagKey(tag.slug, tag.type))
                const dotColor = TAG_TYPE_COLORS[tag.type]
                return (
                  <View key={`${tag.slug}:${tag.type}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
                      <Text style={{ fontFamily: 'Inter', fontSize: 15, color: 'white' }}>
                        {tag.label}
                      </Text>
                      <Text style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255, 255, 255, 0.3)' }}>
                        ({tag.storyCount})
                      </Text>
                    </View>
                    <Switch
                      testID={`edit-feed-toggle-ptag-${tag.slug}`}
                      value={isEnabled}
                      onValueChange={() => togglePromotedTag(tag.slug, tag.type)}
                      trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: 'rgba(255, 255, 255, 0.3)' }}
                      thumbColor="white"
                    />
                  </View>
                )
              })}
            </GlassView>
          )}

          {/* Sort section */}
          <GlassView style={{ padding: 16, gap: 12 }}>
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 14, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: 1 }}>
              SORT ORDER
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {SORT_OPTIONS.map((sort) => {
                const isActive = feedSort === sort
                return (
                  <Pressable key={sort} testID={`edit-feed-sort-${sort}`} onPress={() => setSortOrder(sort)}>
                    <View style={{
                      backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      borderWidth: 0.5,
                      borderColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                      borderRadius: 9999,
                      paddingHorizontal: 14,
                      paddingVertical: 6,
                    }}>
                      <Text style={{
                        fontFamily: 'Inter',
                        fontSize: 13,
                        color: isActive ? 'white' : 'rgba(255, 255, 255, 0.5)',
                      }}>
                        {FEED_SORT_LABELS[sort]}
                      </Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </GlassView>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}
