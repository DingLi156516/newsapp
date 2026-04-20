import { describe, expect, it } from 'vitest'
import {
  buildDeterministicStoryAssembly,
  selectRepresentativeHeadline,
} from '@/lib/ai/deterministic-assembly'

const articles = [
  {
    title: 'Senate passes climate bill after marathon vote',
    description: 'The bill expands clean energy tax credits and funds wildfire response.',
    bias: 'left',
  },
  {
    title: 'Climate bill clears Senate with new spending',
    description: 'Republicans criticized the package as costly while Democrats praised the vote.',
    bias: 'right',
  },
  {
    title: 'Senate approves climate and wildfire package',
    description: 'The measure now heads to the House for consideration.',
    bias: 'center',
  },
] as const

describe('deterministic assembly helpers', () => {
  it('keeps a single-source story extractive and non-interpretive', () => {
    const result = buildDeterministicStoryAssembly([articles[0]], { isSingleSource: true })

    expect(result.headline).toBe('Senate passes climate bill after marathon vote')
    expect(result.topic).toBe('environment')
    expect(result.region).toBe('us')
    expect(result.aiSummary.commonGround).toContain('• Senate passes climate bill after marathon vote')
    expect(result.aiSummary.leftFraming).toBe('')
    expect(result.aiSummary.rightFraming).toBe('')
    expect(result.sentiment).toBeNull()
    expect(result.keyQuotes).toBeNull()
    expect(result.keyClaims).toEqual([
      {
        claim: 'Senate passes climate bill after marathon vote',
        side: 'both',
        disputed: false,
      },
      {
        claim: 'The bill expands clean energy tax credits and funds wildfire response.',
        side: 'both',
        disputed: false,
      },
    ])
  })

  it('groups multi-source framing by source bias without generated interpretation', () => {
    const result = buildDeterministicStoryAssembly(articles, { isSingleSource: false })

    expect(result.headline).toBe('Senate approves climate and wildfire package')
    expect(result.topic).toBe('environment')
    expect(result.region).toBe('us')
    expect(result.aiSummary.commonGround).toContain('• Senate approves climate and wildfire package')
    expect(result.aiSummary.leftFraming).toContain('• Senate passes climate bill after marathon vote')
    expect(result.aiSummary.rightFraming).toContain('• Climate bill clears Senate with new spending')
    expect(result.sentiment).toBeNull()
    expect(result.keyQuotes).toBeNull()
    expect(result.keyClaims?.map((claim) => claim.claim)).toContain(
      'Senate approves climate and wildfire package'
    )
  })

  it('dedupes repeated claim text across title and description', () => {
    const result = buildDeterministicStoryAssembly(
      [
        {
          title: 'NASA launches moon mission',
          description: 'NASA launches moon mission. NASA launches moon mission.',
          bias: 'center',
        },
      ],
      { isSingleSource: true }
    )

    expect(result.keyClaims).toEqual([
      { claim: 'NASA launches moon mission', side: 'both', disputed: false },
    ])
  })

  it('treats multiple articles from one source as single-source when caller says so', () => {
    const sameOutletArticles = [
      {
        title: 'Senate passes climate bill after marathon vote',
        description: 'The bill expands clean energy tax credits and funds wildfire response.',
        bias: 'left',
      },
      {
        title: 'Senate climate bill: what is in the package',
        description: 'A follow-up explainer from the same outlet details the spending provisions.',
        bias: 'left',
      },
    ] as const

    const result = buildDeterministicStoryAssembly(sameOutletArticles, {
      isSingleSource: true,
    })

    expect(result.headline).toBe('Senate passes climate bill after marathon vote')
    expect(result.aiSummary.leftFraming).toBe('')
    expect(result.aiSummary.rightFraming).toBe('')
    expect(result.keyClaims?.every((claim) => claim.side === 'both')).toBe(true)
  })

  it('honors an explicit isSingleSource:false override on the same input', () => {
    const sameInput = [
      {
        title: 'Senate passes climate bill after marathon vote',
        description: 'The bill expands clean energy tax credits and funds wildfire response.',
        bias: 'left',
      },
      {
        title: 'Climate bill clears Senate with new spending',
        description: 'Republicans criticized the package as costly while Democrats praised the vote.',
        bias: 'right',
      },
    ] as const

    const singleSource = buildDeterministicStoryAssembly(sameInput, { isSingleSource: true })
    expect(singleSource.aiSummary.leftFraming).toBe('')
    expect(singleSource.aiSummary.rightFraming).toBe('')

    const multiSource = buildDeterministicStoryAssembly(sameInput, { isSingleSource: false })
    expect(multiSource.aiSummary.leftFraming).toContain('• Senate passes climate bill after marathon vote')
    expect(multiSource.aiSummary.rightFraming).toContain('• Climate bill clears Senate with new spending')
    expect(multiSource.keyClaims?.some((claim) => claim.side === 'left')).toBe(true)
    expect(multiSource.keyClaims?.some((claim) => claim.side === 'right')).toBe(true)
  })

  it('emits a placeholder when a multi-source cluster lacks one bias side', () => {
    const leftOnly = [
      {
        title: 'Progressive outlet covers bill',
        description: 'Desc 1',
        bias: 'far-left',
      },
      {
        title: 'Left-leaning analysis of bill',
        description: 'Desc 2',
        bias: 'left',
      },
    ] as const

    const result = buildDeterministicStoryAssembly(leftOnly, { isSingleSource: false })

    expect(result.aiSummary.leftFraming).toContain('• Progressive outlet covers bill')
    // Right side has no coverage — must render an explicit placeholder
    // instead of an empty string so the AISummaryTabs panel isn't blank.
    expect(result.aiSummary.rightFraming).not.toBe('')
    expect(result.aiSummary.rightFraming.toLowerCase()).toContain('no coverage')
  })

  it('uses classifier-supplied topic/region overrides when provided', () => {
    const result = buildDeterministicStoryAssembly([articles[0]], {
      isSingleSource: true,
      topic: 'technology',
      region: 'uk',
    })

    expect(result.topic).toBe('technology')
    expect(result.region).toBe('uk')
  })

  it('prefers the shortest central headline as the representative headline', () => {
    expect(selectRepresentativeHeadline([
      'Long analysis: What the Senate climate vote means for the future of clean energy policy',
      'Senate approves climate package',
      'Climate bill clears Senate with new spending',
    ])).toBe('Senate approves climate package')
  })
})
