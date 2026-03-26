/**
 * NexusCardSkeleton — Loading placeholder for article cards.
 */

import { View } from 'react-native'
import { GlassView } from '@/components/ui/GlassView'
import { Skeleton } from '@/components/atoms/Skeleton'

export function NexusCardSkeleton() {
  return (
    <GlassView style={{ padding: 20, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Skeleton width={80} height={20} borderRadius={9999} />
        <Skeleton width={60} height={20} borderRadius={9999} />
      </View>
      <Skeleton height={24} />
      <Skeleton width="70%" height={24} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} width={6} height={6} borderRadius={3} />
          ))}
        </View>
        <Skeleton width={40} height={12} />
      </View>
      <Skeleton height={4} borderRadius={9999} />
    </GlassView>
  )
}

export function NexusCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: count }, (_, i) => (
        <NexusCardSkeleton key={i} />
      ))}
    </View>
  )
}
