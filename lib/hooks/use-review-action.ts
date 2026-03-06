/**
 * lib/hooks/use-review-action.ts — Mutation hooks for admin review actions.
 *
 * Provides approve/reject/reprocess functions with loading state.
 */

import { useCallback, useState } from 'react'
import type { AISummary } from '@/lib/types'

interface ReviewEdits {
  readonly headline?: string
  readonly ai_summary?: AISummary
}

export function useReviewAction() {
  const [isLoading, setIsLoading] = useState(false)

  const performAction = useCallback(
    async (
      storyId: string,
      action: 'approve' | 'reject' | 'reprocess',
      edits?: ReviewEdits
    ) => {
      setIsLoading(true)
      try {
        const body: Record<string, unknown> = { action }
        if (edits?.headline) {
          body.headline = edits.headline
        }
        if (edits?.ai_summary) {
          body.ai_summary = edits.ai_summary
        }

        const res = await fetch(`/api/admin/review/${storyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          throw new Error(`Review action failed: ${res.status}`)
        }
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const approve = useCallback(
    (storyId: string, edits?: ReviewEdits) =>
      performAction(storyId, 'approve', edits),
    [performAction]
  )

  const reject = useCallback(
    (storyId: string) => performAction(storyId, 'reject'),
    [performAction]
  )

  const reprocess = useCallback(
    (storyId: string) => performAction(storyId, 'reprocess'),
    [performAction]
  )

  return { approve, reject, reprocess, isLoading }
}
