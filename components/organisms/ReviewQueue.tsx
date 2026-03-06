/**
 * components/organisms/ReviewQueue.tsx — Full split panel layout for admin review.
 *
 * Left panel: scrollable story list with status filter tabs.
 * Right panel: selected story detail with review actions.
 */
'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import { useReviewQueue } from '@/lib/hooks/use-review-queue'
import { useReviewAction } from '@/lib/hooks/use-review-action'
import { useAuth } from '@/lib/hooks/use-auth'
import { ReviewListItem } from '@/components/molecules/ReviewListItem'
import { ReviewDetail } from '@/components/molecules/ReviewDetail'
import { Skeleton } from '@/components/atoms/Skeleton'
import { fetcher } from '@/lib/hooks/fetcher'
import type { ReviewStatus, AISummary } from '@/lib/types'

const FILTER_TABS: { key: ReviewStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

interface StatsResponse {
  readonly success: boolean
  readonly data: {
    readonly pending: number
    readonly approved: number
    readonly rejected: number
  }
}

export function ReviewQueue() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<ReviewStatus>('pending')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const { stories, total, isLoading, mutate } = useReviewQueue({
    status: activeTab,
    page,
  })

  const { approve, reject, reprocess, isLoading: actionLoading } = useReviewAction()

  const { data: statsData, mutate: mutateStats } = useSWR<StatsResponse>(
    user ? '/api/admin/review/stats' : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000 }
  )

  const stats = statsData?.data

  const selectedStory = stories.find((s) => s.id === selectedId) ?? null

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    setEditingId(null)
  }, [])

  const handleTabChange = useCallback((tab: ReviewStatus) => {
    setActiveTab(tab)
    setSelectedId(null)
    setEditingId(null)
    setPage(1)
  }, [])

  const handleApprove = useCallback(
    async (id: string, edits?: { headline: string; ai_summary: AISummary }) => {
      await approve(id, edits)
      setEditingId(null)
      await Promise.all([mutate(), mutateStats()])
    },
    [approve, mutate, mutateStats]
  )

  const handleReject = useCallback(
    async (id: string) => {
      await reject(id)
      await Promise.all([mutate(), mutateStats()])
    },
    [reject, mutate, mutateStats]
  )

  const handleReprocess = useCallback(
    async (id: string) => {
      await reprocess(id)
      await Promise.all([mutate(), mutateStats()])
    },
    [reprocess, mutate, mutateStats]
  )

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      {stats && (
        <div className="flex items-center gap-4 text-xs text-white/60">
          <span className="text-amber-400">{stats.pending} pending</span>
          <span>·</span>
          <span className="text-green-400">{stats.approved} approved</span>
          <span>·</span>
          <span className="text-red-400">{stats.rejected} rejected</span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-white/10">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`relative px-4 py-2 text-sm transition-colors ${
              activeTab === tab.key ? 'text-white' : 'text-white/50 hover:text-white/70'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="review-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
              />
            )}
          </button>
        ))}
      </div>

      {/* Split panel */}
      {isLoading ? (
        <div className="space-y-2" data-testid="review-queue-loading">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : stories.length === 0 ? (
        <div className="glass flex items-center justify-center py-16 text-white/50 text-sm">
          All caught up! No stories in this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left panel: story list */}
          <div className="lg:col-span-2 glass overflow-hidden">
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto scrollbar-hide">
              {stories.map((story) => (
                <ReviewListItem
                  key={story.id}
                  story={story}
                  isSelected={selectedId === story.id}
                  isEditing={editingId === story.id}
                  onClick={handleSelect}
                />
              ))}
            </div>

            {/* Pagination */}
            {total > 20 && (
              <div className="flex items-center justify-between p-3 border-t border-white/10">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-xs text-white/60 hover:text-white disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="text-xs text-white/40">
                  Page {page} of {Math.ceil(total / 20)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(total / 20)}
                  className="text-xs text-white/60 hover:text-white disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Right panel: detail */}
          <div className="lg:col-span-3">
            <ReviewDetail
              story={selectedStory}
              onApprove={handleApprove}
              onReject={handleReject}
              onReprocess={handleReprocess}
              isLoading={actionLoading}
            />
          </div>
        </div>
      )}
    </div>
  )
}
