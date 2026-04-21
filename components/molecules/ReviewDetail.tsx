/**
 * components/molecules/ReviewDetail.tsx — Right panel content for review queue.
 *
 * Two modes: view (read-only) and edit (textareas for headline/summary).
 */
'use client'

import { useState, useCallback } from 'react'
import { Check, X, RefreshCw, Pencil } from 'lucide-react'
import { ReviewStatusBadge } from '@/components/atoms/ReviewStatusBadge'
import { MonochromeSpectrumBar } from '@/components/molecules/MonochromeSpectrumBar'
import { RoutingPreviewPanel } from '@/components/molecules/RoutingPreviewPanel'
import { useRoutingPreview } from '@/lib/hooks/use-routing-preview'
import type { AISummary, SpectrumSegment } from '@/lib/types'

interface ReviewStoryDetail {
  readonly id: string
  readonly headline: string
  readonly topic: string
  readonly region: string
  readonly source_count: number
  readonly spectrum_segments: SpectrumSegment[] | unknown
  readonly ai_summary: AISummary | unknown
  readonly publication_status?: string
  readonly review_reasons?: string[]
  readonly confidence_score?: number | null
  readonly processing_error?: string | null
  readonly review_status: string
  readonly first_published: string
  readonly last_updated: string
}

interface Edits {
  headline: string
  ai_summary: AISummary
}

interface Props {
  story: ReviewStoryDetail | null
  onApprove: (id: string, edits?: Edits) => void
  onReject: (id: string) => void
  onReprocess: (id: string) => void
  isLoading: boolean
}

function parseAISummary(raw: unknown): AISummary {
  if (raw && typeof raw === 'object' && 'commonGround' in raw) {
    return raw as AISummary
  }
  return { commonGround: '', leftFraming: '', rightFraming: '' }
}

function parseSpectrum(raw: unknown): SpectrumSegment[] {
  if (Array.isArray(raw)) return raw as SpectrumSegment[]
  return []
}

export function ReviewDetail({ story, onApprove, onReject, onReprocess, isLoading }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editHeadline, setEditHeadline] = useState('')
  const [editSummary, setEditSummary] = useState<AISummary>({
    commonGround: '',
    leftFraming: '',
    rightFraming: '',
  })

  const {
    preview: routingPreview,
    isLoading: routingLoading,
    error: routingError,
  } = useRoutingPreview(story?.id ?? null)

  const enterEditMode = useCallback(() => {
    if (!story) return
    const summary = parseAISummary(story.ai_summary)
    setEditHeadline(story.headline)
    setEditSummary({ ...summary })
    setIsEditing(true)
  }, [story])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleSaveApprove = useCallback(() => {
    if (!story) return
    onApprove(story.id, {
      headline: editHeadline,
      ai_summary: editSummary,
    })
    setIsEditing(false)
  }, [story, editHeadline, editSummary, onApprove])

  if (!story) {
    return (
      <div className="glass flex items-center justify-center h-full min-h-[400px] text-white/50 text-sm">
        Select a story to review
      </div>
    )
  }

  const summary = parseAISummary(story.ai_summary)
  const spectrum = parseSpectrum(story.spectrum_segments)
  const confidence = typeof story.confidence_score === 'number'
    ? `${Math.round(story.confidence_score * 100)}% confidence`
    : null

  return (
    <div className={`glass p-5 space-y-4 ${isEditing ? 'border border-blue-400/30' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <ReviewStatusBadge
            status={story.review_status as 'pending' | 'approved' | 'rejected'}
          />
        </div>
        <span className="text-xs text-white/40">
          {story.source_count} sources
        </span>
      </div>

      {(confidence || story.review_reasons?.length || story.processing_error) && (
        <div className="space-y-2">
          {confidence && (
            <p className="text-xs text-white/55">{confidence}</p>
          )}
          {story.review_reasons && story.review_reasons.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {story.review_reasons.map((reason) => (
                <span key={reason} className="glass-pill px-2 py-1 text-xs text-amber-300">
                  {reason}
                </span>
              ))}
            </div>
          )}
          {story.processing_error && (
            <div className="glass-sm px-3 py-2 text-xs text-red-300">
              {story.processing_error}
            </div>
          )}
        </div>
      )}

      {/* Routing preview — admin-only visibility into which assembly path
          this story would take given its current articles + biases. */}
      <RoutingPreviewPanel
        preview={routingPreview}
        isLoading={routingLoading}
        error={routingError}
      />

      {/* Headline */}
      {isEditing ? (
        <textarea
          value={editHeadline}
          onChange={(e) => setEditHeadline(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-lg text-white font-bold resize-none"
          style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
          rows={2}
        />
      ) : (
        <h2
          className="text-lg font-bold text-white"
          style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
        >
          {story.headline}
        </h2>
      )}

      {/* Spectrum bar */}
      {spectrum.length > 0 && (
        <MonochromeSpectrumBar segments={spectrum} />
      )}

      {/* AI Summary sections — skip left/right for single-source stories */}
      <div className="space-y-3">
        {(['commonGround', 'leftFraming', 'rightFraming'] as const)
          .filter((key) => {
            if (story.source_count <= 1 && (key === 'leftFraming' || key === 'rightFraming')) {
              return false
            }
            return true
          })
          .map((key) => {
          const labels = {
            commonGround: story.source_count <= 1 ? 'Summary' : 'Common Ground',
            leftFraming: 'Left Perspective',
            rightFraming: 'Right Perspective',
          }
          return (
            <div key={key} className="space-y-1">
              <p className="text-xs text-white/60 uppercase tracking-widest">
                {labels[key]}
              </p>
              {isEditing ? (
                <textarea
                  value={editSummary[key]}
                  onChange={(e) =>
                    setEditSummary((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white/80 resize-none"
                  rows={3}
                />
              ) : (
                <p className="text-sm text-white/80 leading-relaxed">
                  {summary[key] || '—'}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Unsaved changes indicator */}
      {isEditing && (
        <p className="text-xs text-blue-400">Unsaved changes</p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/10">
        {isEditing ? (
          <>
            <button
              onClick={cancelEdit}
              className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/70 hover:text-white transition-colors"
              aria-label="Cancel"
            >
              <X size={14} />
              Cancel
            </button>
            <button
              onClick={handleSaveApprove}
              disabled={isLoading}
              className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
              aria-label="Save & Approve"
            >
              <Check size={14} />
              Save & Approve
            </button>
          </>
        ) : (
          <>
            <button
              onClick={enterEditMode}
              className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/70 hover:text-white transition-colors"
              aria-label="Edit"
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              onClick={() => onReject(story.id)}
              disabled={isLoading}
              className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
              aria-label="Reject"
            >
              <X size={14} />
              Reject
            </button>
            <button
              onClick={() => onReprocess(story.id)}
              disabled={isLoading}
              className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/70 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Reprocess"
            >
              <RefreshCw size={14} />
              Reprocess
            </button>
            <button
              onClick={() => onApprove(story.id, undefined)}
              disabled={isLoading}
              className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
              aria-label="Approve"
            >
              <Check size={14} />
              Approve
            </button>
          </>
        )}
      </div>
    </div>
  )
}
