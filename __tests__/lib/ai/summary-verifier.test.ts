/**
 * Tests for lib/ai/summary-verifier.ts — hallucination guard around
 * generateAISummary. keyQuotes must appear in some article (fuzzy
 * whitespace); keyClaims must have >=60% token overlap. Framing and
 * commonGround are synthesized and not verified.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AISummary, KeyQuote, KeyClaim } from '@/lib/types'
import type { ArticleWithBias, ExpandedSummaryResult } from '@/lib/ai/summary-generator'

// Module under test + the module it wraps. We mock generateAISummary to
// control each round's output without hitting the LLM.
vi.mock('@/lib/ai/summary-generator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/summary-generator')>()
  return {
    ...actual,
    generateAISummary: vi.fn(),
  }
})

import {
  verifyQuote,
  verifyClaim,
  verifySummary,
  generateVerifiedAISummary,
} from '@/lib/ai/summary-verifier'
import { generateAISummary } from '@/lib/ai/summary-generator'

const mockGenerateAISummary = vi.mocked(generateAISummary)

const articles: ArticleWithBias[] = [
  {
    title: 'Senate passes climate bill after marathon vote',
    description: 'Senator Jones said the bill "marks a turning point for clean energy policy."',
    bias: 'left',
  },
  {
    title: 'Climate bill clears Senate with new spending',
    description: 'Republicans criticized the package as costly while Democrats praised the vote.',
    bias: 'right',
  },
]

const summaryShape = (
  overrides: Partial<ExpandedSummaryResult> = {}
): ExpandedSummaryResult => ({
  aiSummary: {
    commonGround: '• Senate passed the bill',
    leftFraming: '• progressive win',
    rightFraming: '• costly package',
  } satisfies AISummary,
  sentiment: { left: 'hopeful', right: 'critical' },
  keyQuotes: null,
  keyClaims: null,
  ...overrides,
})

describe('verifyQuote', () => {
  it('verifies an exact quote from an article description', () => {
    const quote: KeyQuote = {
      text: 'marks a turning point for clean energy policy.',
      sourceName: 'Source A',
      sourceBias: 'left',
    }
    expect(verifyQuote(quote, articles)).toBe(true)
  })

  it('verifies a quote from an article title', () => {
    const quote: KeyQuote = {
      text: 'Climate bill clears Senate with new spending',
      sourceName: 'Source B',
      sourceBias: 'right',
    }
    expect(verifyQuote(quote, articles)).toBe(true)
  })

  it('tolerates whitespace differences', () => {
    const quote: KeyQuote = {
      text: 'marks  a turning point  for  clean  energy policy',
      sourceName: 'Source A',
      sourceBias: 'left',
    }
    expect(verifyQuote(quote, articles)).toBe(true)
  })

  it('tolerates unicode punctuation differences (curly vs straight quotes, em/en dashes, ellipses)', () => {
    // Article text uses typographic curly quotes / em-dash; model emits
    // the same quote with ASCII punctuation. Without normalization these
    // near-identical strings would fail verification and trigger a
    // spurious regeneration.
    const fancyArticles: ArticleWithBias[] = [
      {
        title: 'Report on policy',
        description:
          'The official said \u201cit\u2019s going to work\u201d \u2014 a claim backed by data\u2026',
        bias: 'center',
      },
    ]
    const quote: KeyQuote = {
      text: '"it\'s going to work" - a claim backed by data...',
      sourceName: 'Source',
      sourceBias: 'center',
    }
    expect(verifyQuote(quote, fancyArticles)).toBe(true)
  })

  it('rejects short quotes that only match as substrings within larger words', () => {
    // 'cost' should not match 'costly'; 'turn' should not match 'turning'.
    // Quotes are supposed to be verbatim snippets, matched at word
    // boundaries, not loose substring hits.
    const quoteCost: KeyQuote = {
      text: 'cost',
      sourceName: 'Source A',
      sourceBias: 'left',
    }
    const quoteTurn: KeyQuote = {
      text: 'turn',
      sourceName: 'Source A',
      sourceBias: 'left',
    }
    expect(verifyQuote(quoteCost, articles)).toBe(false)
    expect(verifyQuote(quoteTurn, articles)).toBe(false)
  })

  it('rejects a quote that does not appear in any article', () => {
    const quote: KeyQuote = {
      text: 'This bill will destroy the economy',
      sourceName: 'Fake Source',
      sourceBias: 'right',
    }
    expect(verifyQuote(quote, articles)).toBe(false)
  })

  it('accepts a quote when sourceName matches, even if the model uses a non-enum bias label', () => {
    // Verifier canonicalizes sourceBias to the article's bias on
    // success. Requiring the raw bias string to fit the L/C/R enum
    // before match causes false negatives when the model emits
    // 'liberal', 'left-leaning', etc.
    const outlet: ArticleWithBias[] = [
      {
        title: 'Real headline',
        description: 'Grounded line appears here.',
        bias: 'lean-left',
        sourceName: 'Outlet A',
      },
    ]
    const quote: KeyQuote = {
      text: 'Grounded line appears here.',
      sourceName: 'Outlet A',
      sourceBias: 'left-leaning', // non-enum label
    }
    expect(verifyQuote(quote, outlet)).toBe(true)
  })

  it('accepts a quote when sourceName matches even if bias label drifts (lean-left vs left)', () => {
    // When the assembler provides outlet names, the outlet match proves
    // attribution — we should not reject grounded quotes just because
    // the model normalized 'lean-left' to 'left' or 'far-right' to
    // 'right'. Bias-label drift is common LLM behavior.
    const mixedArticles: ArticleWithBias[] = [
      {
        title: 'Headline',
        description: 'Real verbatim line from this outlet.',
        bias: 'lean-left',
        sourceName: 'Some Outlet',
      },
    ]
    const quote: KeyQuote = {
      text: 'Real verbatim line from this outlet.',
      sourceName: 'Some Outlet',
      sourceBias: 'left',
    }
    expect(verifyQuote(quote, mixedArticles)).toBe(true)
  })

  it('tolerates braces/parens/quotes around attribution (in case the model echoes the prompt delimiter)', () => {
    // Prompt formats outlets as [BIAS] {Outlet} — if the model echoes
    // the brace wrapper in keyQuote.sourceName, we should not reject
    // what is otherwise a grounded quote.
    const wrappedArticles: ArticleWithBias[] = [
      {
        title: 'Headline',
        description: 'Grounded passage here.',
        bias: 'center',
        sourceName: 'The Source',
      },
    ]
    const quote: KeyQuote = {
      text: 'Grounded passage here.',
      sourceName: '{The Source}',
      sourceBias: 'center',
    }
    expect(verifyQuote(quote, wrappedArticles)).toBe(true)
  })

  it('tolerates cosmetic case/whitespace differences in sourceBias and sourceName', () => {
    // Model sometimes echoes BIAS in upper-case (matching the prompt tag)
    // and wraps outlet names with stray whitespace. These are formatting
    // differences, not misattributions — verifier must not reject.
    const cosmeticArticles: ArticleWithBias[] = [
      {
        title: 'A headline',
        description: 'Senator Jones said "grounded quote here."',
        bias: 'left',
        sourceName: 'The New York Times',
      },
    ]
    const quote: KeyQuote = {
      text: 'grounded quote here.',
      sourceName: '  The New York Times  ',
      sourceBias: 'LEFT',
    }
    expect(verifyQuote(quote, cosmeticArticles)).toBe(true)
  })

  it('rejects a quote attributed to a different outlet of the same bias', () => {
    // Two LEFT outlets in the cluster. Quote text exists only in
    // Outlet A's description, but model attributed it to Outlet B.
    // Checking only bias would let this through.
    const twoLeftArticles: ArticleWithBias[] = [
      {
        title: 'A headline',
        description: 'Senator Jones said "this is verbatim quote here."',
        bias: 'left',
        sourceName: 'Outlet A',
      },
      {
        title: 'B different headline',
        description: 'Different content entirely.',
        bias: 'left',
        sourceName: 'Outlet B',
      },
    ]
    const quote: KeyQuote = {
      text: 'this is verbatim quote here.',
      sourceName: 'Outlet B',
      sourceBias: 'left',
    }
    expect(verifyQuote(quote, twoLeftArticles)).toBe(false)
  })

  it('rejects a quote whose text is real but attributed to the wrong bias', () => {
    // "marks a turning point..." exists only in the LEFT article, but
    // the model attributed it to a RIGHT source. Passing this would let
    // misattributed quotes render in KeyQuotes under the wrong outlet.
    const quote: KeyQuote = {
      text: 'marks a turning point for clean energy policy.',
      sourceName: 'Right Outlet',
      sourceBias: 'right',
    }
    expect(verifyQuote(quote, articles)).toBe(false)
  })

  it('rejects a quote that spans the title/description boundary', () => {
    // Concatenating title + description would let a quote starting at
    // the end of one field and ending in the next pass as grounded.
    const quote: KeyQuote = {
      text: 'marathon vote Senator Jones said',
      sourceName: 'Source A',
      sourceBias: 'left',
    }
    expect(verifyQuote(quote, articles)).toBe(false)
  })
})

describe('verifyClaim', () => {
  it('verifies a claim that paraphrases article content (>=60% token overlap)', () => {
    const claim: KeyClaim = {
      claim: 'The Senate passed the climate bill',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, articles)).toBe(true)
  })

  it('rejects a claim whose side does not align with the article bucket where evidence appears', () => {
    // Article appears only in left coverage. Model labels the claim as
    // side:'right'. UI renders the side badge verbatim — a mislabeled
    // claim would be visibly wrong.
    const leftOnlyArticles: ArticleWithBias[] = [
      {
        title: 'Climate bill analysis',
        description: 'Senate passed climate bill expanding clean energy tax credits.',
        bias: 'left',
      },
    ]
    const claim: KeyClaim = {
      claim: 'The Senate passed the climate bill',
      side: 'right',
      disputed: false,
    }
    expect(verifyClaim(claim, leftOnlyArticles)).toBe(false)
  })

  it('accepts a claim with side:both against any article bucket', () => {
    const leftOnlyArticles: ArticleWithBias[] = [
      {
        title: 'Climate bill analysis',
        description: 'Senate passed climate bill expanding clean energy tax credits.',
        bias: 'left',
      },
    ]
    const claim: KeyClaim = {
      claim: 'The Senate passed the climate bill',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, leftOnlyArticles)).toBe(true)
  })

  it('strips sentence-final periods so short claims match across punctuation', () => {
    // Short claim where every token matters. Article has 'cuts.' at
    // end of sentence; claim has 'cuts' without the period. Without
    // stripping trailing dots, these tokens would not match.
    // Claim carries a trailing period that the article doesn't; token
    // 'cuts.' vs 'cuts' would otherwise fail the overlap check.
    const articlesWithoutPeriod: ArticleWithBias[] = [
      {
        title: 'Tax cuts',
        description: null,
        bias: 'center',
      },
    ]
    const claim: KeyClaim = {
      claim: 'tax cuts.',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, articlesWithoutPeriod)).toBe(true)
  })

  it('rejects a claim with a decimal mismatch', () => {
    // 12.5% vs 13.5% is a numeric hallucination on a decimal — the
    // digit-mismatch check must handle decimals, not just integers.
    const decimalArticles: ArticleWithBias[] = [
      {
        title: 'Housing report',
        description: '13.5% of homes were damaged in the storm.',
        bias: 'center',
      },
    ]
    const claim: KeyClaim = {
      claim: '12.5 percent of homes were damaged in the storm',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, decimalArticles)).toBe(false)
  })

  it('tolerates formatted numbers (1,000 vs 1000, 12.5% vs 12.5 percent)', () => {
    // Thousand-separators and percent-sign formatting are cosmetic —
    // they should not trigger hasDigitMismatch.
    const numericArticles: ArticleWithBias[] = [
      {
        title: 'Report on aid',
        description: '1,000 civilians were displaced and 12.5% of homes were damaged.',
        bias: 'center',
      },
    ]
    const claim: KeyClaim = {
      claim: '1000 civilians were displaced and 12.5 percent of homes were damaged',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, numericArticles)).toBe(true)
  })

  it('rejects a claim with a digit mismatch (numeric hallucination)', () => {
    // "10 civilians" vs claim "12 civilians" — without preserving
    // digit tokens, both collapse to {civilians} and match 100%.
    const numericArticles: ArticleWithBias[] = [
      {
        title: 'Report',
        description: '10 civilians were injured in the blast.',
        bias: 'center',
      },
    ]
    const claim: KeyClaim = {
      claim: '12 civilians were injured in the blast',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, numericArticles)).toBe(false)
  })

  it('rejects a claim that flips polarity (passed vs rejected)', () => {
    // Bag-of-words would see 3/4 token overlap between
    // "senate passed climate bill" and "senate rejected climate bill"
    // and accept it. Reject polarity flips explicitly.
    const polarityArticles: ArticleWithBias[] = [
      {
        title: 'Senate passed climate bill',
        description: 'Senate passed climate bill yesterday.',
        bias: 'center',
      },
    ]
    const claim: KeyClaim = {
      claim: 'Senate rejected climate bill',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, polarityArticles)).toBe(false)
  })

  it('does not reject a grounded claim when the article has an unrelated negation', () => {
    // Article mentions 'not' in one clause but the claim matches a
    // different grounded clause. Whole-article polarity should not
    // turn that into a flip.
    const articlesWithUnrelatedNegation: ArticleWithBias[] = [
      {
        title: 'Senate passed climate bill',
        description: 'The bill is not retroactive but Senate passed climate bill yesterday.',
        bias: 'center',
      },
    ]
    const claim: KeyClaim = {
      claim: 'Senate passed climate bill',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, articlesWithUnrelatedNegation)).toBe(true)
  })

  it('does not reject a grounded claim when article mentions both passed and rejected', () => {
    // Article mentions both outcomes in different contexts. Claim
    // assertion aligns with 'passed' — should verify.
    const articles: ArticleWithBias[] = [
      {
        title: 'Legislation update',
        description: 'An earlier version was rejected, but the Senate passed climate bill today.',
        bias: 'center',
      },
    ]
    const claim: KeyClaim = {
      claim: 'Senate passed climate bill',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, articles)).toBe(true)
  })

  it('rejects a claim that drops a negation ("no injuries") from the article', () => {
    // Article: "no injuries were reported". Claim: "injuries were
    // reported". Without keeping 'no' as a token, overlap is 100%
    // even though the claim flips the meaning.
    const negArticles: ArticleWithBias[] = [
      {
        title: 'Update',
        description: 'No injuries were reported in the incident.',
        bias: 'center',
      },
    ]
    const claim: KeyClaim = {
      claim: 'Injuries were reported in the incident',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, negArticles)).toBe(false)
  })

  it('distinguishes actor short-codes (US vs EU)', () => {
    // Article says US approved, claim says EU approved. Two-letter
    // codes are dropped by the short-word filter, so overlap on
    // 'approved sanctions' alone would pass. Preserve short codes.
    const actorArticles: ArticleWithBias[] = [
      {
        title: 'Sanctions news',
        description: 'The US approved new sanctions yesterday.',
        bias: 'center',
      },
    ]
    const claim: KeyClaim = {
      claim: 'The EU approved new sanctions yesterday',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, actorArticles)).toBe(false)
  })

  it('rejects when the article negates the claim (article has "not approved", claim says approved)', () => {
    const negArticles: ArticleWithBias[] = [
      {
        title: 'Bill update',
        description: 'The bill was not approved today.',
        bias: 'center',
      },
    ]
    const claim: KeyClaim = {
      claim: 'The bill was approved today',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, negArticles)).toBe(false)
  })

  it('rejects a claim introducing a negation (not/never) not in any article', () => {
    const polarityArticles: ArticleWithBias[] = [
      {
        title: 'The bill was approved by congress',
        description: 'Legislators voted to approve the bill yesterday.',
        bias: 'center',
      },
    ]
    const claim: KeyClaim = {
      claim: 'The bill was not approved by congress',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, polarityArticles)).toBe(false)
  })

  it('rejects a claim with insufficient token overlap', () => {
    const claim: KeyClaim = {
      claim: 'Aliens visited Washington yesterday unexpectedly',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, articles)).toBe(false)
  })

  it('splits on punctuation so hyphenated compounds in articles match space-separated claims', () => {
    // Article uses "cease-fire" as a compound. Model paraphrases the
    // same claim with spaces. Without splitting on punctuation, the
    // article side becomes one token ("ceasefire") and overlap would
    // fall below threshold even though the claim is clearly grounded.
    const compoundArticles: ArticleWithBias[] = [
      {
        title: 'Cease-fire holds in region',
        description: 'Court-approved deal from U.S.-backed mediators.',
        bias: 'center',
      },
    ]
    const claim: KeyClaim = {
      claim: 'The cease fire deal was court approved by U S backed mediators',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, compoundArticles)).toBe(true)
  })

  it('ignores short words (<=2 chars) when computing overlap', () => {
    // Without short-word filtering, 'of on in' stopwords would inflate
    // overlap — verifyClaim should use the same tokenizer as story-metrics.
    const claim: KeyClaim = {
      claim: 'of of of of of of of of of of',
      side: 'both',
      disputed: false,
    }
    expect(verifyClaim(claim, articles)).toBe(false)
  })
})

describe('verifySummary', () => {
  it('canonicalizes verified quote attribution to the matched article values', () => {
    // Model returned sourceBias='LEFT' (uppercase) and sourceName with
    // stray whitespace. Verifier treats these as equivalent for the
    // match, but the downstream UI renders these fields verbatim —
    // BIAS_CSS_CLASS['LEFT'] would miss, badge would be unstyled.
    // Canonicalize to the article's actual outlet name + bias.
    const canonicalArticles: ArticleWithBias[] = [
      {
        title: 'A headline',
        description: 'Grounded quote appears here.',
        bias: 'lean-left',
        sourceName: 'The New York Times',
      },
    ]
    const summary = summaryShape({
      keyQuotes: [
        {
          text: 'Grounded quote appears here.',
          sourceName: '  The New York Times  ',
          sourceBias: 'LEFT',
        },
      ],
    })
    const result = verifySummary(summary, canonicalArticles)
    expect(result.verified.keyQuotes).toHaveLength(1)
    const kept = result.verified.keyQuotes![0]
    expect(kept.sourceName).toBe('The New York Times')
    expect(kept.sourceBias).toBe('lean-left')
  })

  it('keeps quotes and claims that verify and drops those that do not', () => {
    const summary = summaryShape({
      keyQuotes: [
        { text: 'marks a turning point for clean energy policy.', sourceName: 'A', sourceBias: 'left' },
        { text: 'fabricated hallucinated statement', sourceName: 'A', sourceBias: 'left' },
      ],
      keyClaims: [
        { claim: 'The Senate passed the climate bill', side: 'both', disputed: false },
        { claim: 'Aliens invaded Washington', side: 'left', disputed: false },
      ],
    })

    const result = verifySummary(summary, articles)

    expect(result.verified.keyQuotes).toHaveLength(1)
    expect(result.verified.keyQuotes?.[0].text).toContain('turning point')
    expect(result.verified.keyClaims).toHaveLength(1)
    expect(result.verified.keyClaims?.[0].claim).toContain('climate bill')
    expect(result.droppedQuotes).toEqual(['fabricated hallucinated statement'])
    expect(result.droppedClaims).toEqual(['Aliens invaded Washington'])
  })

  it('leaves framing and commonGround untouched', () => {
    const summary = summaryShape({
      keyQuotes: [{ text: 'fake quote', sourceName: 'A', sourceBias: 'left' }],
      keyClaims: null,
    })

    const result = verifySummary(summary, articles)

    expect(result.verified.aiSummary).toEqual(summary.aiSummary)
  })

  it('strips an ungrounded counterClaim even when disputed=false', () => {
    // parseResponseClaims preserves counterClaim regardless of the
    // disputed flag, and ClaimsComparison renders it — so any ungrounded
    // counterClaim must be stripped, not just those flagged disputed.
    const summary = summaryShape({
      keyQuotes: null,
      keyClaims: [
        {
          claim: 'The Senate passed the climate bill',
          side: 'both',
          disputed: false,
          counterClaim: 'Made-up rebuttal from nowhere',
        },
      ],
    })

    const result = verifySummary(summary, articles)

    expect(result.verified.keyClaims).toHaveLength(1)
    expect(result.verified.keyClaims![0].counterClaim).toBeUndefined()
    expect(result.droppedClaims).toContain('Made-up rebuttal from nowhere')
  })

  it('strips ungrounded counterClaim from a disputed claim (keeps the grounded main claim)', () => {
    // Main claim has real overlap with articles → keep. But the
    // counterClaim is fabricated and cannot be verified → strip the
    // counterClaim and clear the disputed flag so ClaimsComparison
    // doesn't render a fake rebuttal.
    const summary = summaryShape({
      keyQuotes: null,
      keyClaims: [
        {
          claim: 'The Senate passed the climate bill',
          side: 'both',
          disputed: true,
          counterClaim: 'Aliens opposed the bill in a secret session',
        },
      ],
    })

    const result = verifySummary(summary, articles)

    expect(result.verified.keyClaims).toHaveLength(1)
    const kept = result.verified.keyClaims![0]
    expect(kept.claim).toContain('climate bill')
    expect(kept.disputed).toBe(false)
    expect(kept.counterClaim).toBeUndefined()
    expect(result.droppedClaims).toEqual([
      'Aliens opposed the bill in a secret session',
    ])
  })

  it('treats null keyQuotes/keyClaims as nothing to verify', () => {
    const summary = summaryShape({ keyQuotes: null, keyClaims: null })
    const result = verifySummary(summary, articles)
    expect(result.droppedQuotes).toEqual([])
    expect(result.droppedClaims).toEqual([])
    expect(result.verified.keyQuotes).toBeNull()
    expect(result.verified.keyClaims).toBeNull()
  })
})

describe('generateVerifiedAISummary', () => {
  beforeEach(() => {
    mockGenerateAISummary.mockReset()
  })

  it('accepts the first-round output when every quote/claim verifies', async () => {
    const cleanOutput = summaryShape({
      keyQuotes: [
        { text: 'marks a turning point for clean energy policy.', sourceName: 'A', sourceBias: 'left' },
      ],
      keyClaims: [
        { claim: 'The Senate passed the climate bill', side: 'both', disputed: false },
      ],
    })
    mockGenerateAISummary.mockResolvedValueOnce(cleanOutput)

    const result = await generateVerifiedAISummary(articles)

    expect(mockGenerateAISummary).toHaveBeenCalledTimes(1)
    expect(result.result.keyQuotes).toHaveLength(1)
    expect(result.verificationRounds).toBe(1)
    expect(result.verificationDroppedCount).toBe(0)
  })

  it('regenerates with drop hints when the first round has hallucinations', async () => {
    // Round 1: one bad quote. Round 2: the model honors the drop hint
    // and returns only verified content.
    const dirtyOutput = summaryShape({
      keyQuotes: [
        { text: 'fabricated statement', sourceName: 'A', sourceBias: 'left' },
      ],
      keyClaims: [
        { claim: 'The Senate passed the climate bill', side: 'both', disputed: false },
      ],
    })
    const cleanOutput = summaryShape({
      keyQuotes: [
        { text: 'marks a turning point for clean energy policy.', sourceName: 'A', sourceBias: 'left' },
      ],
      keyClaims: [
        { claim: 'The Senate passed the climate bill', side: 'both', disputed: false },
      ],
    })

    mockGenerateAISummary
      .mockResolvedValueOnce(dirtyOutput)
      .mockResolvedValueOnce(cleanOutput)

    const result = await generateVerifiedAISummary(articles)

    expect(mockGenerateAISummary).toHaveBeenCalledTimes(2)
    expect(result.verificationRounds).toBe(2)
    // Second call received drop hints for the bad quote.
    const secondCallArgs = mockGenerateAISummary.mock.calls[1]
    expect(secondCallArgs[1]).toEqual(
      expect.objectContaining({
        regenerationHints: expect.objectContaining({
          dropQuotes: ['fabricated statement'],
        }),
      })
    )
    expect(result.result.keyQuotes).toHaveLength(1)
  })

  it('preserves quotes/claims that verified in an earlier round when a later regeneration degrades', async () => {
    // Round 1: one verified quote + one hallucinated quote. Round 2: no
    // hallucinations dropped from earlier list but the model replaces the
    // good quote with a new hallucination. Without merge-across-rounds,
    // the earlier verified quote would be silently lost.
    const round1 = summaryShape({
      keyQuotes: [
        { text: 'marks a turning point for clean energy policy.', sourceName: 'A', sourceBias: 'left' },
        { text: 'fabricated statement', sourceName: 'A', sourceBias: 'left' },
      ],
      keyClaims: null,
    })
    const round2 = summaryShape({
      keyQuotes: [
        // Regeneration dropped the only grounded quote and introduced a new fake.
        { text: 'another hallucinated line', sourceName: 'A', sourceBias: 'left' },
      ],
      keyClaims: null,
    })
    const round3 = summaryShape({
      keyQuotes: [
        { text: 'still made up', sourceName: 'A', sourceBias: 'left' },
      ],
      keyClaims: null,
    })

    mockGenerateAISummary
      .mockResolvedValueOnce(round1)
      .mockResolvedValueOnce(round2)
      .mockResolvedValueOnce(round3)

    const result = await generateVerifiedAISummary(articles)

    // The originally-verified quote must survive even though later rounds dropped it.
    expect(result.result.keyQuotes).not.toBeNull()
    const texts = result.result.keyQuotes!.map((q) => q.text)
    expect(texts).toContain('marks a turning point for clean energy policy.')
  })

  it('keeps the best non-fallback framing when a later round returns the fallback summary', async () => {
    // Round 1: decent framing + one hallucinated quote → regenerate.
    // Round 2: generateAISummary falls back (empty response internally).
    // Round 3: also fallback.
    // The earlier framing/commonGround + any verified quote from round 1
    // should persist — don't overwrite with 'AI summary generation failed'.
    const round1 = summaryShape({
      aiSummary: {
        commonGround: '• real common ground content here',
        leftFraming: '• left framing real',
        rightFraming: '• right framing real',
      },
      keyQuotes: [
        { text: 'marks a turning point for clean energy policy.', sourceName: 'A', sourceBias: 'left' },
        { text: 'fabricated', sourceName: 'A', sourceBias: 'left' },
      ],
      keyClaims: null,
    })
    const fallback = summaryShape({
      aiSummary: {
        commonGround: 'AI summary generation failed. Manual review needed.',
        leftFraming: 'Analysis unavailable.',
        rightFraming: 'Analysis unavailable.',
      },
      sentiment: null,
      keyQuotes: null,
      keyClaims: null,
    })

    mockGenerateAISummary
      .mockResolvedValueOnce(round1)
      .mockResolvedValueOnce(fallback)
      .mockResolvedValueOnce(fallback)

    const result = await generateVerifiedAISummary(articles)

    expect(result.result.aiSummary.commonGround).toContain('real common ground content')
    expect(result.result.keyQuotes).not.toBeNull()
    expect(result.result.keyQuotes?.map((q) => q.text)).toContain(
      'marks a turning point for clean energy policy.'
    )
  })

  it('does not accept a fallback-summary round as a clean pass', async () => {
    // generateAISummary's own fallback returns this commonGround when
    // Gemini fails. It has no quotes/claims, so verifySummary reports
    // zero drops — but treating that as "clean" would downgrade stories
    // that still had retries available.
    const fallbackOutput = summaryShape({
      aiSummary: {
        commonGround: 'AI summary generation failed. Manual review needed.',
        leftFraming: 'Analysis unavailable.',
        rightFraming: 'Analysis unavailable.',
      },
      sentiment: null,
      keyQuotes: null,
      keyClaims: null,
    })
    const cleanOutput = summaryShape({
      keyQuotes: [
        { text: 'marks a turning point for clean energy policy.', sourceName: 'A', sourceBias: 'left' },
      ],
      keyClaims: null,
    })

    mockGenerateAISummary
      .mockResolvedValueOnce(fallbackOutput)
      .mockResolvedValueOnce(cleanOutput)

    const result = await generateVerifiedAISummary(articles)

    // Verifier should have retried instead of stopping on the fallback round.
    expect(mockGenerateAISummary).toHaveBeenCalledTimes(2)
    expect(result.result.keyQuotes).toHaveLength(1)
  })

  it('prefers later-round side/disputed metadata when merging same-text claims', async () => {
    // Round 1: claim text X with side='both'. Round 2: same text with
    // side='left' (refined). Dedupe should prefer the later version.
    const claimText = 'The Senate passed the climate bill'
    // Round 1 has a hallucinated quote that forces regen; rounds 2/3
    // refine the side metadata.
    const round1 = summaryShape({
      keyQuotes: [{ text: 'fabricated quote', sourceName: 'A', sourceBias: 'left' }],
      keyClaims: [{ claim: claimText, side: 'both', disputed: false }],
    })
    const round2 = summaryShape({
      keyQuotes: null,
      keyClaims: [{ claim: claimText, side: 'left', disputed: false }],
    })
    const round3 = summaryShape({
      keyQuotes: null,
      keyClaims: [{ claim: claimText, side: 'left', disputed: false }],
    })

    mockGenerateAISummary
      .mockResolvedValueOnce(round1)
      .mockResolvedValueOnce(round2)
      .mockResolvedValueOnce(round3)

    const result = await generateVerifiedAISummary(articles)

    expect(result.result.keyClaims).toHaveLength(1)
    expect(result.result.keyClaims![0].side).toBe('left')
  })

  it('prefers a later-round claim with a verified counterClaim over an earlier stripped version', async () => {
    // Round 1: counterClaim is fabricated, so verifier strips it and
    // clears disputed. Round 2: model returns the same main claim with
    // a grounded counterClaim. The final merge should prefer the
    // richer round-2 claim, not silently keep the stripped one.
    const claimText = 'The Senate passed the climate bill'
    const roundStripped = summaryShape({
      keyQuotes: null,
      keyClaims: [
        {
          claim: claimText,
          side: 'both',
          disputed: true,
          counterClaim: 'Fabricated rebuttal one',
        },
      ],
    })
    const roundRepaired = summaryShape({
      keyQuotes: null,
      keyClaims: [
        {
          claim: claimText,
          side: 'left',
          disputed: true,
          counterClaim: 'Republicans criticized the package as costly',
        },
      ],
    })
    const roundClean = summaryShape({
      keyQuotes: null,
      keyClaims: [
        {
          claim: claimText,
          side: 'left',
          disputed: true,
          counterClaim: 'Republicans criticized the package as costly',
        },
      ],
    })

    mockGenerateAISummary
      .mockResolvedValueOnce(roundStripped)
      .mockResolvedValueOnce(roundRepaired)
      .mockResolvedValueOnce(roundClean)

    const result = await generateVerifiedAISummary(articles)

    expect(result.result.keyClaims).toHaveLength(1)
    const kept = result.result.keyClaims![0]
    expect(kept.counterClaim).toContain('Republicans criticized')
    expect(kept.disputed).toBe(true)
  })

  it('keeps the latest non-fallback framing when the final round falls back', async () => {
    // Sequence: non-fallback round 1 → improved non-fallback round 2 →
    // fallback round 3. When reverting from fallback, prefer round 2's
    // refined output over round 1.
    const round1 = summaryShape({
      aiSummary: {
        commonGround: '• cg round 1',
        leftFraming: '• lf r1',
        rightFraming: '• rf r1',
      },
      keyQuotes: [
        { text: 'fabricated one', sourceName: 'A', sourceBias: 'left' },
      ],
    })
    const round2 = summaryShape({
      aiSummary: {
        commonGround: '• cg round 2 refined',
        leftFraming: '• lf r2',
        rightFraming: '• rf r2',
      },
      keyQuotes: [
        { text: 'fabricated two', sourceName: 'A', sourceBias: 'left' },
      ],
    })
    const fallback = summaryShape({
      aiSummary: {
        commonGround: 'AI summary generation failed. Manual review needed.',
        leftFraming: 'Analysis unavailable.',
        rightFraming: 'Analysis unavailable.',
      },
    })

    mockGenerateAISummary
      .mockResolvedValueOnce(round1)
      .mockResolvedValueOnce(round2)
      .mockResolvedValueOnce(fallback)

    const result = await generateVerifiedAISummary(articles)

    expect(result.result.aiSummary.commonGround).toBe('• cg round 2 refined')
  })

  it('uses the final round framing when every round was non-fallback (exhausted regens, no better signal)', async () => {
    // All 3 rounds non-fallback, all 3 have at least one unverified
    // quote. The final round's framing is the most recent response to
    // prior drop hints — prefer it over sticking with round 1.
    const round1 = summaryShape({
      aiSummary: {
        commonGround: '• cg round 1',
        leftFraming: '• lf r1',
        rightFraming: '• rf r1',
      },
      keyQuotes: [
        { text: 'marks a turning point for clean energy policy.', sourceName: 'A', sourceBias: 'left' },
        { text: 'fabricated one', sourceName: 'A', sourceBias: 'left' },
      ],
    })
    const round2 = summaryShape({
      aiSummary: {
        commonGround: '• cg round 2',
        leftFraming: '• lf r2',
        rightFraming: '• rf r2',
      },
      keyQuotes: [
        { text: 'fabricated two', sourceName: 'A', sourceBias: 'left' },
      ],
    })
    const round3 = summaryShape({
      aiSummary: {
        commonGround: '• cg round 3',
        leftFraming: '• lf r3',
        rightFraming: '• rf r3',
      },
      keyQuotes: [
        { text: 'fabricated three', sourceName: 'A', sourceBias: 'left' },
      ],
    })

    mockGenerateAISummary
      .mockResolvedValueOnce(round1)
      .mockResolvedValueOnce(round2)
      .mockResolvedValueOnce(round3)

    const result = await generateVerifiedAISummary(articles)

    // With all non-fallback rounds, final round framing wins.
    expect(result.result.aiSummary.commonGround).toBe('• cg round 3')
  })

  it('caps merged quotes/claims at 3 even when multiple rounds each verify a few', async () => {
    // Contract is 1-3 quotes and 1-3 claims. If every retry round
    // contributes 3 unique verified items, the merge must not produce
    // 9 — cap to 3.
    const roundA = summaryShape({
      keyQuotes: [
        { text: 'Senate passes climate bill after marathon vote', sourceName: 'A', sourceBias: 'left' },
        { text: 'marks a turning point for clean energy policy.', sourceName: 'A', sourceBias: 'left' },
        { text: 'fabricated one', sourceName: 'A', sourceBias: 'left' },
      ],
      keyClaims: [
        { claim: 'Senate passes climate bill after marathon vote', side: 'both', disputed: false },
        { claim: 'Climate bill clears Senate with new spending', side: 'both', disputed: false },
        { claim: 'Fabricated claim one', side: 'left', disputed: false },
      ],
    })
    const roundB = summaryShape({
      keyQuotes: [
        { text: 'Climate bill clears Senate with new spending', sourceName: 'B', sourceBias: 'right' },
        { text: 'Republicans criticized the package as costly while Democrats praised the vote.', sourceName: 'B', sourceBias: 'right' },
        { text: 'fabricated two', sourceName: 'B', sourceBias: 'right' },
      ],
      keyClaims: [
        { claim: 'Republicans criticized the package as costly', side: 'right', disputed: false },
      ],
    })
    const roundC = summaryShape({
      keyQuotes: [
        { text: 'The bill expands clean energy tax credits and funds wildfire response.', sourceName: 'A', sourceBias: 'left' },
      ],
      keyClaims: [
        { claim: 'The bill expands clean energy tax credits and funds wildfire response', side: 'left', disputed: false },
      ],
    })

    mockGenerateAISummary
      .mockResolvedValueOnce(roundA)
      .mockResolvedValueOnce(roundB)
      .mockResolvedValueOnce(roundC)

    const result = await generateVerifiedAISummary(articles)

    expect(result.result.keyQuotes).not.toBeNull()
    expect(result.result.keyQuotes!.length).toBeLessThanOrEqual(3)
    expect(result.result.keyClaims).not.toBeNull()
    expect(result.result.keyClaims!.length).toBeLessThanOrEqual(3)
  })

  it('after max rounds, drops still-unverified quotes/claims and keeps the rest', async () => {
    // Always hallucinate. After 3 attempts (1 initial + 2 regens), accept
    // the framing/commonGround but null out unverified keyQuotes/keyClaims.
    const alwaysDirty = summaryShape({
      keyQuotes: [
        { text: 'still fabricated', sourceName: 'A', sourceBias: 'left' },
      ],
      keyClaims: [
        { claim: 'Still hallucinated nonsense', side: 'left', disputed: false },
      ],
    })
    mockGenerateAISummary.mockResolvedValue(alwaysDirty)

    const result = await generateVerifiedAISummary(articles)

    expect(mockGenerateAISummary).toHaveBeenCalledTimes(3)
    expect(result.verificationRounds).toBe(3)
    expect(result.verificationDroppedCount).toBeGreaterThan(0)
    // Unverified quotes/claims dropped to null; framing/commonGround kept.
    expect(result.result.keyQuotes).toBeNull()
    expect(result.result.keyClaims).toBeNull()
    expect(result.result.aiSummary).toEqual(alwaysDirty.aiSummary)
  })
})
