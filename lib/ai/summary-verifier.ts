/**
 * lib/ai/summary-verifier.ts — Hallucination guard for the rich-path
 * summary generator.
 *
 * generateAISummary already validates JSON shape. It does not check
 * whether the quoted text or claim language actually appears in the
 * source articles. This wrapper:
 *
 *   1. Verifies each keyQuote.text has a fuzzy-whitespace match in some
 *      article's title+description (quotes are user-facing verbatim —
 *      highest hallucination-damage vector).
 *   2. Verifies each keyClaim.claim has >=60% token overlap with some
 *      article (claims paraphrase — looser bar).
 *   3. Re-invokes generateAISummary with regeneration hints when any
 *      verification fails (max 2 regenerations = 3 total attempts).
 *   4. If after all rounds some items still fail, drops the unverified
 *      entries and keeps whatever was verified. Framing / commonGround
 *      are deliberately synthesized and not verified.
 */

import type { KeyQuote, KeyClaim } from '@/lib/types'
import {
  generateAISummary,
  isFallbackSummary,
  type ArticleWithBias,
  type ExpandedSummaryResult,
} from '@/lib/ai/summary-generator'
import { LEFT_BIASES, RIGHT_BIASES } from '@/lib/ai/deterministic-assembly'

const MAX_REGENERATIONS = 2
const CLAIM_OVERLAP_THRESHOLD = 0.6
// Lower bar for a single sentence to "support" a claim. A sentence
// sharing just one stray token isn't evidence the claim matches there
// — require substantive overlap before polarity-checking against that
// sentence (and before counting it as supporting evidence).
const SENTENCE_SUPPORT_THRESHOLD = 0.3
// UI / storage contract: generateAISummary produces 1-3 quotes and 1-3
// claims per story. After merging across up to 3 rounds the raw list
// can blow past that bound, so cap the final output.
const MAX_OUTPUT_ITEMS = 3

export interface VerifiedSummaryResult {
  readonly result: ExpandedSummaryResult
  readonly verificationRounds: number
  readonly verificationDroppedCount: number
}

export interface VerifySummaryOutcome {
  readonly verified: ExpandedSummaryResult
  readonly droppedQuotes: string[]
  readonly droppedClaims: string[]
}

// Map typographic unicode punctuation to its ASCII equivalent so that
// quotes emitted by the model with ASCII characters still match article
// text that uses curly quotes, em/en dashes, or ellipses (common
// publisher typography). Without this step, near-identical strings that
// differ only in punctuation form trigger spurious regenerations.
const PUNCTUATION_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\u2018\u2019\u201A\u201B\u2032]/g, "'"],
  [/[\u201C\u201D\u201E\u201F\u2033]/g, '"'],
  [/[\u2013\u2014\u2212]/g, '-'],
  [/\u2026/g, '...'],
  [/\u00A0/g, ' '],
]

function normalizePunctuation(value: string): string {
  let out = value
  for (const [pattern, replacement] of PUNCTUATION_MAP) {
    out = out.replace(pattern, replacement)
  }
  return out
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeForMatch(value: string): string {
  return normalizeWhitespace(normalizePunctuation(value)).toLowerCase()
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Word-boundary match against a normalized haystack. Prevents a short
// or fragmentary quote like "cost" from passing against "costly" —
// verbatim quotes should sit at word boundaries, not substring inside
// longer words. We use explicit alphanumeric boundaries rather than
// \b so that needles starting or ending with punctuation (e.g. "policy.")
// still match — \b sits between word and non-word chars and wouldn't
// fire right after a trailing period.
function matchesAsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false
  const escaped = escapeRegex(needle)
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?=[^a-z0-9]|$)`)
  return pattern.test(haystack)
}

// Each field normalized separately so a quote that straddles the
// title/description boundary (last words of title + first words of
// description) does NOT match across the join — that kind of synthesis
// is a hallucination path, not extraction.
function articleFields(article: ArticleWithBias): readonly string[] {
  const out = [normalizeForMatch(article.title)]
  if (article.description) out.push(normalizeForMatch(article.description))
  return out.filter((f) => f.length > 0)
}

// Token set used for claim overlap. >2 char filter drops stopwords,
// but digit tokens are always kept — numeric hallucinations ("10
// civilians" vs "12 civilians") would otherwise pass with 100%
// non-digit overlap. Replaces non-alphanumeric characters with spaces
// (rather than stripping them) so hyphenated compounds like
// "cease-fire", "U.S.-backed", "court-approved" split into their
// component tokens — otherwise the article side collapses to one
// token ("ceasefire") while the claim side stays split, artificially
// suppressing overlap.
function normalizeNumericFormatting(text: string): string {
  return text
    // Collapse thousand separators: "1,000" → "1000"
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
    // Percent sign → word, so "12.5%" and "12.5 percent" tokenize the same
    .replace(/%/g, ' percent ')
}

// Short tokens that carry real signal for claim verification. Without
// an allowlist, the default >2 char filter drops:
//   - negations ('no')
//   - geopolitical actors that change the subject of a claim entirely
//     ('us', 'uk', 'eu', 'un', 'nato')
// Keeping them in the token set means wrong-actor or dropped-negation
// claims lose their 60% overlap and fail verification.
const MEANINGFUL_SHORT_TOKENS: ReadonlySet<string> = new Set([
  'no', 'us', 'uk', 'eu', 'un', 'ai', 'tv', 'nyc', 'nra', 'fbi',
  'cia', 'irs', 'gop', 'dnc', 'rnc', 'who', 'imf', 'icj', 'icc',
])

function tokenize(text: string): Set<string> {
  return new Set(
    normalizeNumericFormatting(text)
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, ' ')
      .split(/\s+/)
      // Strip leading/trailing dots from each token so sentence-final
      // punctuation ('cuts.') doesn't prevent matching the same word
      // mid-sentence ('cuts'). Decimals like '12.5' keep their
      // interior dot because only edges are stripped.
      .map((w) => w.replace(/^\.+|\.+$/g, ''))
      .filter((w) => w.length > 0)
      .filter((w) => w.length > 2 || /\d/.test(w) || MEANINGFUL_SHORT_TOKENS.has(w))
  )
}

// Split article text into sentence-ish fragments so polarity checks
// operate on a single clause rather than the entire article. Prevents
// an unrelated negation in a different sentence from flagging an
// otherwise-grounded claim, while still letting a negation in the
// SAME clause as the claim content flag the contradiction.
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// Words that flip the polarity of a claim. If a claim carries one of
// these and the article does not (or vice versa), bag-of-words overlap
// alone cannot catch the contradiction — surface it explicitly.
const POLARITY_FLIPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['approved', ['rejected', 'defeated', 'blocked', 'opposed', 'killed', 'failed', 'refused', 'vetoed']],
  ['passed', ['rejected', 'defeated', 'blocked', 'failed', 'stalled']],
  ['supported', ['opposed', 'rejected']],
  ['endorsed', ['opposed', 'rejected']],
  ['accepted', ['rejected', 'refused']],
  ['won', ['lost']],
  ['increased', ['decreased', 'fell', 'dropped']],
  ['rose', ['fell', 'dropped']],
  ['confirmed', ['denied', 'rejected']],
]

const NEGATION_TOKENS: ReadonlySet<string> = new Set([
  'no', 'not', 'never', 'none', 'nothing', 'neither',
])

function hasDigitMismatch(
  claimTokens: ReadonlySet<string>,
  articleTokens: ReadonlySet<string>
): boolean {
  // Match both integers (42) and decimals (12.5). Integer digits always
  // stay, decimals survive because the tokenizer now keeps '.' inside
  // numeric tokens.
  const numericPattern = /^\d+(?:\.\d+)?$/
  for (const token of claimTokens) {
    if (numericPattern.test(token) && !articleTokens.has(token)) return true
  }
  return false
}

// Reject when the claim names an actor short-code ('US', 'EU', 'NATO')
// that doesn't appear in the article — wrong-subject hallucinations
// dominate on short codes (claim's 'eu' vs article's 'us') where the
// bag-of-words overlap on the rest of the sentence would otherwise
// mask the substitution.
function hasShortTokenMismatch(
  claimTokens: ReadonlySet<string>,
  articleTokens: ReadonlySet<string>
): boolean {
  for (const token of claimTokens) {
    if (MEANINGFUL_SHORT_TOKENS.has(token) && !articleTokens.has(token)) {
      return true
    }
  }
  return false
}

// Detect a polarity flip between a claim and a SINGLE sentence from
// the source article. Sentence-level scoping means an unrelated
// negation elsewhere in the article can't false-positive a grounded
// claim: the conflict only fires when the claim matches the same
// clause that carries the contradicting polarity.
function polarityConflict(
  claim: ReadonlySet<string>,
  article: ReadonlySet<string>
): boolean {
  for (const [lhs, opposites] of POLARITY_FLIPS) {
    // Claim asserts lhs that article does not assert, but article has
    // an opposite verb. e.g. claim "passed", article "rejected".
    if (claim.has(lhs) && !article.has(lhs)) {
      for (const rhs of opposites) {
        if (article.has(rhs)) return true
      }
    }
    // Mirror: claim uses an opposite verb that article does not,
    // article has the lhs. e.g. claim "rejected", article "passed".
    for (const rhs of opposites) {
      if (claim.has(rhs) && !article.has(rhs) && article.has(lhs)) {
        return true
      }
    }
  }
  // Negations at sentence scope are always meaningful. A "not" in the
  // SAME clause as the claim's overlap flips meaning regardless of
  // which side carries it.
  for (const neg of NEGATION_TOKENS) {
    if (claim.has(neg) !== article.has(neg)) return true
  }
  return false
}

// Case-insensitive, whitespace-tolerant attribution comparison. The
// model may echo `LEFT` from the prompt tag, pad outlet names with
// stray whitespace, or carry over the `{...}` wrapper the summary
// prompt uses around outlet names. Treat these as equivalent.
function attributionEquals(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return normalizeAttribution(a) === normalizeAttribution(b)
}

function normalizeAttribution(value: string): string {
  return value
    .trim()
    .replace(/^[\s{}()[\]"'“”‘’]+|[\s{}()[\]"'“”‘’]+$/g, '')
    .toLowerCase()
}

// L/C/R bucket lookup. Labels drift within a bucket ('lean-left' vs
// 'left') but a flip across buckets is a real misattribution — the UI
// renders badges directly from these fields.
function biasBucket(bias: string | undefined): 'left' | 'center' | 'right' | 'unknown' {
  if (!bias) return 'unknown'
  const normalized = bias.trim().toLowerCase()
  if (LEFT_BIASES.has(normalized)) return 'left'
  if (RIGHT_BIASES.has(normalized)) return 'right'
  if (normalized === 'center') return 'center'
  return 'unknown'
}

function sameBucket(a: string | undefined, b: string | undefined): boolean {
  const ba = biasBucket(a)
  const bb = biasBucket(b)
  if (ba === 'unknown' || bb === 'unknown') return false
  return ba === bb
}

// Find the article a quote came from (if any). Returning the matched
// article lets the caller canonicalize sourceName/sourceBias to the
// article's actual values — keeping downstream UI lookups like
// BIAS_CSS_CLASS[bias] from missing on cosmetic drift.
export function findQuoteSource(
  quote: KeyQuote,
  articles: readonly ArticleWithBias[]
): ArticleWithBias | null {
  const needle = normalizeForMatch(quote.text)
  if (!needle) return null
  for (const article of articles) {
    // Outlet match is the primary attribution check. When the article
    // carries a sourceName, sourceName must match — this proves the
    // quote came from the right outlet. Bias-label drift within a
    // bucket is tolerated ('lean-left' vs 'left') but a flip across
    // buckets (article LEFT, quote labeled RIGHT) is rejected because
    // KeyQuotes renders the bias badge verbatim.
    if (article.sourceName) {
      // Outlet name already proves attribution. The model's raw
      // sourceBias string doesn't have to fit our L/C/R enum — we
      // canonicalize to the article's bias on success anyway, so
      // requiring a bucket match here just produces false negatives
      // when the model emits labels like 'liberal' or 'left-leaning'.
      if (!attributionEquals(article.sourceName, quote.sourceName)) continue
    } else {
      if (!attributionEquals(article.bias, quote.sourceBias)) continue
    }
    if (articleFields(article).some((field) => matchesAsPhrase(field, needle))) {
      return article
    }
  }
  return null
}

export function verifyQuote(
  quote: KeyQuote,
  articles: readonly ArticleWithBias[]
): boolean {
  return findQuoteSource(quote, articles) !== null
}

// Does an article's bias bucket align with the claimed side?
//   side='left'  → article must be in the L bucket
//   side='right' → article must be in the R bucket
//   side='both'  → any article qualifies (claim spans the spectrum)
// The UI renders the side badge verbatim, so a claim only in right
// coverage labeled 'left' would be visibly wrong.
function sideAllowsArticle(side: KeyClaim['side'], article: ArticleWithBias): boolean {
  if (side === 'both') return true
  const bucket = biasBucket(article.bias)
  if (side === 'left') return bucket === 'left'
  if (side === 'right') return bucket === 'right'
  return false
}

export function verifyClaim(
  claim: KeyClaim,
  articles: readonly ArticleWithBias[]
): boolean {
  const claimTokens = tokenize(claim.claim)
  if (claimTokens.size === 0) return false

  for (const article of articles) {
    if (!sideAllowsArticle(claim.side, article)) continue

    // Article-wide overlap lets cross-sentence paraphrases match
    // (a claim can legitimately summarize content spread across
    // title + description). Polarity conflict, however, is a
    // SENTENCE-level property — an unrelated 'not' in one clause
    // must not poison a claim that matches a different clause.
    const fullText = `${article.title}. ${article.description ?? ''}`
    const articleTokens = tokenize(fullText)
    if (articleTokens.size === 0) continue

    let overlap = 0
    for (const token of claimTokens) {
      if (articleTokens.has(token)) overlap += 1
    }
    if (overlap / claimTokens.size < CLAIM_OVERLAP_THRESHOLD) continue

    // Digit / short-code substitutions are article-wide: a claim
    // naming '12.5%' or 'EU' that never appears anywhere in the
    // article is a hallucination regardless of which sentence matches.
    if (hasDigitMismatch(claimTokens, articleTokens)) continue
    if (hasShortTokenMismatch(claimTokens, articleTokens)) continue

    // Accept if SOME sentence supports the claim without polarity
    // conflict. Sentences with no shared content are skipped so
    // unrelated clauses don't weigh in; sentences that do share
    // content must not carry a contradicting polarity.
    const sentences = splitSentences(fullText)
    let supported = false
    for (const sentence of sentences) {
      const sentenceTokens = tokenize(sentence)
      let sentenceOverlap = 0
      for (const token of claimTokens) {
        if (sentenceTokens.has(token)) sentenceOverlap += 1
      }
      if (sentenceOverlap / claimTokens.size < SENTENCE_SUPPORT_THRESHOLD) continue
      if (polarityConflict(claimTokens, sentenceTokens)) continue
      supported = true
      break
    }

    if (supported) return true
  }

  return false
}

export function verifySummary(
  summary: ExpandedSummaryResult,
  articles: readonly ArticleWithBias[]
): VerifySummaryOutcome {
  const droppedQuotes: string[] = []
  const droppedClaims: string[] = []

  // Canonicalize attribution on verified quotes: if a quote matches, we
  // already know which article produced it, so replace the (possibly
  // differently-cased / padded) model output with the article's actual
  // outlet name and bias. Prevents downstream UI lookups like
  // BIAS_CSS_CLASS[bias] from missing when the model returned "LEFT".
  const verifiedQuotes = summary.keyQuotes
    ? summary.keyQuotes.flatMap((q) => {
        const source = findQuoteSource(q, articles)
        if (!source) {
          droppedQuotes.push(q.text)
          return []
        }
        return [
          {
            ...q,
            sourceBias: source.bias,
            sourceName: source.sourceName ?? q.sourceName,
          },
        ]
      })
    : null

  // Claims with a disputed=true counterClaim need BOTH sides verified.
  // If only the main claim verifies, strip the unverified counterClaim
  // and clear the disputed flag so ClaimsComparison doesn't render a
  // fabricated rebuttal next to a real claim.
  const verifiedClaims = summary.keyClaims
    ? summary.keyClaims
        .map((c) => {
          const mainOk = verifyClaim(c, articles)
          if (!mainOk) {
            droppedClaims.push(c.claim)
            return null
          }

          if (c.counterClaim) {
            // A counterClaim represents the OPPOSING side, so verify it
            // against that bucket rather than the main claim's side.
            // Symmetric for left/right; 'both' has no single opposite so
            // we fall back to 'both' (no side restriction).
            const opposingSide: KeyClaim['side'] =
              c.side === 'left' ? 'right' : c.side === 'right' ? 'left' : 'both'
            const counterOk = verifyClaim(
              { claim: c.counterClaim, side: opposingSide, disputed: false },
              articles
            )
            if (!counterOk) {
              droppedClaims.push(c.counterClaim)
              const { counterClaim: _dropped, ...stripped } = c
              return { ...stripped, disputed: false } as KeyClaim
            }
          }

          return c
        })
        .filter((c): c is KeyClaim => c !== null)
    : null

  return {
    verified: {
      ...summary,
      keyQuotes: verifiedQuotes && verifiedQuotes.length > 0 ? verifiedQuotes : null,
      keyClaims: verifiedClaims && verifiedClaims.length > 0 ? verifiedClaims : null,
    },
    droppedQuotes,
    droppedClaims,
  }
}

function dedupeQuotes(quotes: readonly KeyQuote[]): KeyQuote[] {
  const seen = new Set<string>()
  const out: KeyQuote[] = []
  for (const quote of quotes) {
    const key = normalizeForMatch(quote.text)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(quote)
    if (out.length >= MAX_OUTPUT_ITEMS) break
  }
  return out
}

function dedupeClaims(claims: readonly KeyClaim[]): KeyClaim[] {
  const byKey = new Map<string, KeyClaim>()
  for (const claim of claims) {
    const key = normalizeForMatch(claim.claim)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, claim)
      continue
    }
    // Last-seen wins on metadata (side, disputed) so later verified
    // rounds refine earlier entries. But if the earlier copy had a
    // grounded counterClaim and the later one lost it, retain the
    // earlier counterClaim/disputed — regeneration may have dropped
    // the opposing side without it being newly fabricated.
    if (existing.counterClaim && !claim.counterClaim) {
      byKey.set(key, {
        ...claim,
        counterClaim: existing.counterClaim,
        disputed: existing.disputed,
      })
    } else {
      byKey.set(key, claim)
    }
  }
  return [...byKey.values()].slice(0, MAX_OUTPUT_ITEMS)
}

export async function generateVerifiedAISummary(
  articles: readonly ArticleWithBias[]
): Promise<VerifiedSummaryResult> {
  let rounds = 0
  let dropHints: { dropQuotes: string[]; dropClaims: string[] } = {
    dropQuotes: [],
    dropClaims: [],
  }
  let lastOutcome: VerifySummaryOutcome | null = null

  // Accumulate every quote/claim that successfully verified across all
  // rounds. Later regenerations that discard earlier grounded items
  // should not silently lose them — tests explicitly cover this case.
  const mergedQuotes: KeyQuote[] = []
  const mergedClaims: KeyClaim[] = []
  // Track the LATEST non-fallback framing seen. Used as a safety net
  // when the final round fell back to the "AI failed" placeholder —
  // in that case we restore this framing instead of shipping the
  // fallback text. Tracking latest (not first) means a sequence like
  // round1(usable) → round2(refined) → round3(fallback) keeps the
  // round-2 refinement rather than regressing to round 1.
  let bestNonFallback: ExpandedSummaryResult | null = null
  let lastWasFallback = false

  for (let attempt = 0; attempt <= MAX_REGENERATIONS; attempt += 1) {
    rounds += 1

    const rawSummary = await generateAISummary(
      articles,
      attempt === 0 ? undefined : { regenerationHints: dropHints }
    )

    const outcome = verifySummary(rawSummary, articles)
    lastOutcome = outcome

    const isFallback = isFallbackSummary(rawSummary)
    lastWasFallback = isFallback
    if (!isFallback) {
      bestNonFallback = outcome.verified
    }

    if (outcome.verified.keyQuotes) mergedQuotes.push(...outcome.verified.keyQuotes)
    if (outcome.verified.keyClaims) mergedClaims.push(...outcome.verified.keyClaims)

    const hasHallucinations =
      outcome.droppedQuotes.length > 0 || outcome.droppedClaims.length > 0

    // A fallback summary (generateAISummary's own last-resort output)
    // has no quotes/claims to drop, so verifySummary reports zero
    // hallucinations. Accepting that as a clean pass would downgrade
    // stories to the "AI failed" fallback even when regenerations are
    // still available — keep retrying if attempts remain.
    const hasAttemptsRemaining = attempt < MAX_REGENERATIONS

    if (!hasHallucinations && !(isFallback && hasAttemptsRemaining)) {
      const base = isFallback && bestNonFallback ? bestNonFallback : outcome.verified
      return {
        result: {
          ...base,
          keyQuotes: mergedQuotes.length > 0 ? dedupeQuotes(mergedQuotes) : null,
          keyClaims: mergedClaims.length > 0 ? dedupeClaims(mergedClaims) : null,
        },
        verificationRounds: rounds,
        verificationDroppedCount: 0,
      }
    }

    // Accumulate drop hints so the regeneration prompt can name the
    // specific fabrications to avoid.
    dropHints = {
      dropQuotes: [...dropHints.dropQuotes, ...outcome.droppedQuotes],
      dropClaims: [...dropHints.dropClaims, ...outcome.droppedClaims],
    }
  }

  // Exhausted regenerations — pick the framing source. If the final
  // round was non-fallback, use it (most recent response to drop
  // hints). Otherwise fall back to the first non-fallback round so we
  // don't ship the 'AI summary generation failed' placeholder.
  const finalOutcome = lastOutcome!
  const base = lastWasFallback
    ? (bestNonFallback ?? finalOutcome.verified)
    : finalOutcome.verified
  return {
    result: {
      ...base,
      keyQuotes: mergedQuotes.length > 0 ? dedupeQuotes(mergedQuotes) : null,
      keyClaims: mergedClaims.length > 0 ? dedupeClaims(mergedClaims) : null,
    },
    verificationRounds: rounds,
    verificationDroppedCount:
      finalOutcome.droppedQuotes.length + finalOutcome.droppedClaims.length,
  }
}
