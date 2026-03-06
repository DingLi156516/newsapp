'use client'

import { FeedTabs } from '@/components/organisms/FeedTabs'
import type { FeedTab } from '@/lib/types'

interface Props {
  readonly feedTab: FeedTab
  readonly onFeedTabChange: (v: FeedTab) => void
  readonly savedCount?: number
  readonly blindspotCount?: number
}

export function StickyFilterBar({
  feedTab,
  onFeedTabChange,
  savedCount = 0,
  blindspotCount = 0,
}: Props) {
  return (
    <div
      className="sticky top-0 z-40 flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 border-b border-white/[0.04]"
      style={{
        backgroundColor: 'rgba(10, 10, 10, 0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <FeedTabs
        value={feedTab}
        onChange={onFeedTabChange}
        savedCount={savedCount}
        blindspotCount={blindspotCount}
      />
    </div>
  )
}
