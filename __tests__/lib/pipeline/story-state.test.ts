import { describe, it, expect } from 'vitest'
import {
  decideStoryPublication,
  mapLegacyStoryState,
  isAiSummaryFallback,
} from '@/lib/pipeline/story-state'

describe('isAiSummaryFallback', () => {
  it('detects fallback summaries that require review', () => {
    expect(
      isAiSummaryFallback({
        commonGround: 'AI summary generation failed. Manual review needed.',
        leftFraming: 'Analysis unavailable.',
        rightFraming: 'Analysis unavailable.',
      })
    ).toBe(true)
  })

  it('returns false for normal summaries', () => {
    expect(
      isAiSummaryFallback({
        commonGround: '• Fact one',
        leftFraming: '• Left framing',
        rightFraming: '• Right framing',
      })
    ).toBe(false)
  })
})

describe('decideStoryPublication', () => {
  it('auto-publishes a high-confidence story', () => {
    const result = decideStoryPublication({
      articleCount: 4,
      sourceCount: 3,
      isBlindspot: false,
      factuality: 'high',
      aiSummary: {
        commonGround: '• Shared fact',
        leftFraming: '• Left angle',
        rightFraming: '• Right angle',
      },
      processingError: null,
    })

    expect(result.publicationStatus).toBe('published')
    expect(result.reviewStatus).toBe('approved')
    expect(result.reviewReasons).toEqual([])
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7)
  })

  it('auto-publishes blindspot stories (blindspot is a feature, not a defect)', () => {
    const result = decideStoryPublication({
      articleCount: 4,
      sourceCount: 3,
      isBlindspot: true,
      factuality: 'high',
      aiSummary: {
        commonGround: '• Shared fact',
        leftFraming: '• Left angle',
        rightFraming: '• Right angle',
      },
      processingError: null,
    })

    expect(result.publicationStatus).toBe('published')
    expect(result.reviewStatus).toBe('approved')
    expect(result.reviewReasons).toEqual([])
  })

  it('auto-publishes sparse evidence stories (no sparse_coverage gate)', () => {
    const result = decideStoryPublication({
      articleCount: 1,
      sourceCount: 1,
      isBlindspot: false,
      factuality: 'high',
      aiSummary: {
        commonGround: '• Shared fact',
        leftFraming: '• Left angle',
        rightFraming: '• Right angle',
      },
      processingError: null,
    })

    expect(result.publicationStatus).toBe('published')
    expect(result.reviewStatus).toBe('approved')
    expect(result.reviewReasons).toEqual([])
  })

  it('auto-publishes single-source stories (singleton parity with Ground News)', () => {
    const result = decideStoryPublication({
      articleCount: 1,
      sourceCount: 1,
      isBlindspot: true,
      factuality: 'mixed',
      aiSummary: {
        commonGround: '• Single source fact',
        leftFraming: '• Single source left',
        rightFraming: '• Single source right',
      },
      processingError: null,
    })

    expect(result.publicationStatus).toBe('published')
    expect(result.reviewStatus).toBe('approved')
    expect(result.reviewReasons).toEqual([])
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7)
  })

  it('requires review for fallback ai output', () => {
    const result = decideStoryPublication({
      articleCount: 4,
      sourceCount: 3,
      isBlindspot: false,
      factuality: 'high',
      aiSummary: {
        commonGround: 'AI summary generation failed. Manual review needed.',
        leftFraming: 'Analysis unavailable.',
        rightFraming: 'Analysis unavailable.',
      },
      processingError: null,
    })

    expect(result.publicationStatus).toBe('needs_review')
    expect(result.reviewReasons).toContain('ai_fallback')
  })

  it('auto-publishes mixed-factuality stories (factuality is user-filtered, not gated)', () => {
    const result = decideStoryPublication({
      articleCount: 4,
      sourceCount: 3,
      isBlindspot: false,
      factuality: 'mixed',
      aiSummary: {
        commonGround: '• Shared fact',
        leftFraming: '• Left angle',
        rightFraming: '• Right angle',
      },
      processingError: null,
    })

    expect(result.publicationStatus).toBe('published')
    expect(result.reviewStatus).toBe('approved')
    expect(result.reviewReasons).toEqual([])
  })

  it('requires review when assembly recorded a processing anomaly', () => {
    const result = decideStoryPublication({
      articleCount: 4,
      sourceCount: 3,
      isBlindspot: false,
      factuality: 'high',
      aiSummary: {
        commonGround: '• Shared fact',
        leftFraming: '• Left angle',
        rightFraming: '• Right angle',
      },
      processingError: 'summary parser fallback',
    })

    expect(result.publicationStatus).toBe('needs_review')
    expect(result.reviewReasons).toContain('processing_anomaly')
  })
})

describe('mapLegacyStoryState', () => {
  it('maps legacy approved stories to published', () => {
    expect(
      mapLegacyStoryState({
        reviewStatus: 'approved',
        headline: 'Real headline',
        hasAiSummary: true,
      })
    ).toMatchObject({
      assemblyStatus: 'completed',
      publicationStatus: 'published',
      reviewStatus: 'approved',
      reviewReasons: [],
    })
  })

  it('maps placeholder pending stories to draft pending assembly', () => {
    expect(
      mapLegacyStoryState({
        reviewStatus: 'pending',
        headline: 'Pending headline generation',
        hasAiSummary: false,
      })
    ).toMatchObject({
      assemblyStatus: 'pending',
      publicationStatus: 'draft',
      reviewStatus: 'pending',
    })
  })

  it('maps assembled pending stories to needs_review', () => {
    expect(
      mapLegacyStoryState({
        reviewStatus: 'pending',
        headline: 'Real headline',
        hasAiSummary: true,
      })
    ).toMatchObject({
      assemblyStatus: 'completed',
      publicationStatus: 'needs_review',
      reviewStatus: 'pending',
      reviewReasons: ['legacy_pending_review'],
    })
  })

  it('maps malformed legacy rows to repair review', () => {
    expect(
      mapLegacyStoryState({
        reviewStatus: 'pending',
        headline: 'Real headline',
        hasAiSummary: false,
      })
    ).toMatchObject({
      assemblyStatus: 'completed',
      publicationStatus: 'needs_review',
      reviewReasons: ['legacy_data_repair'],
    })
  })

  it('maps rejected stories to rejected publication', () => {
    expect(
      mapLegacyStoryState({
        reviewStatus: 'rejected',
        headline: 'Real headline',
        hasAiSummary: true,
      })
    ).toMatchObject({
      assemblyStatus: 'completed',
      publicationStatus: 'rejected',
      reviewStatus: 'rejected',
    })
  })
})
