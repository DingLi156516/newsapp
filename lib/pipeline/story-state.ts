import type { AISummary, FactualityLevel, ReviewStatus } from '@/lib/types'

export type AssemblyStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type PublicationStatus = 'draft' | 'needs_review' | 'published' | 'rejected'

export interface PublicationDecisionInput {
  readonly articleCount: number
  readonly sourceCount: number
  readonly isBlindspot: boolean
  readonly factuality: FactualityLevel
  readonly aiSummary: AISummary
  readonly processingError: string | null
}

export interface PublicationDecision {
  readonly publicationStatus: PublicationStatus
  readonly reviewStatus: ReviewStatus
  readonly reviewReasons: string[]
  readonly confidenceScore: number
}

interface LegacyStoryStateInput {
  readonly reviewStatus: ReviewStatus
  readonly headline: string
  readonly hasAiSummary: boolean
}

interface LegacyStoryState {
  readonly assemblyStatus: AssemblyStatus
  readonly publicationStatus: PublicationStatus
  readonly reviewStatus: ReviewStatus
  readonly reviewReasons: string[]
}

const SUMMARY_FALLBACK_PATTERNS = [
  'AI summary generation failed. Manual review needed.',
  'Analysis unavailable.',
  'Analysis pending.',
] as const

export function isAiSummaryFallback(summary: AISummary): boolean {
  return SUMMARY_FALLBACK_PATTERNS.some((pattern) =>
    summary.commonGround.includes(pattern) ||
    summary.leftFraming.includes(pattern) ||
    summary.rightFraming.includes(pattern)
  )
}

export function decideStoryPublication(input: PublicationDecisionInput): PublicationDecision {
  const reviewReasons: string[] = []
  let confidenceScore = 0.9

  if (isAiSummaryFallback(input.aiSummary)) {
    reviewReasons.push('ai_fallback')
    confidenceScore -= 0.25
  }

  if (input.processingError) {
    reviewReasons.push('processing_anomaly')
    confidenceScore -= 0.25
  }

  const normalizedScore = Math.max(0, Math.min(1, Number(confidenceScore.toFixed(2))))

  if (reviewReasons.length > 0) {
    return {
      publicationStatus: 'needs_review',
      reviewStatus: 'pending',
      reviewReasons,
      confidenceScore: normalizedScore,
    }
  }

  return {
    publicationStatus: 'published',
    reviewStatus: 'approved',
    reviewReasons: [],
    confidenceScore: normalizedScore,
  }
}

export function mapLegacyStoryState(input: LegacyStoryStateInput): LegacyStoryState {
  if (input.reviewStatus === 'approved') {
    return {
      assemblyStatus: 'completed',
      publicationStatus: 'published',
      reviewStatus: 'approved',
      reviewReasons: [],
    }
  }

  if (input.reviewStatus === 'rejected') {
    return {
      assemblyStatus: 'completed',
      publicationStatus: 'rejected',
      reviewStatus: 'rejected',
      reviewReasons: [],
    }
  }

  if (input.headline === 'Pending headline generation') {
    return {
      assemblyStatus: 'pending',
      publicationStatus: 'draft',
      reviewStatus: 'pending',
      reviewReasons: [],
    }
  }

  if (!input.hasAiSummary) {
    return {
      assemblyStatus: 'completed',
      publicationStatus: 'needs_review',
      reviewStatus: 'pending',
      reviewReasons: ['legacy_data_repair'],
    }
  }

  return {
    assemblyStatus: 'completed',
    publicationStatus: 'needs_review',
    reviewStatus: 'pending',
    reviewReasons: ['legacy_pending_review'],
  }
}
