/**
 * lib/ai/entity-extractor.ts — Deterministic entity extraction for stories.
 *
 * Extracts lightweight tags from titles/descriptions without a model call.
 * The output is intentionally conservative: proper-name phrases, acronyms,
 * a small set of geography aliases, and topic keywords.
 */

export type EntityType = 'person' | 'organization' | 'location' | 'event' | 'topic'

export interface ExtractedEntity {
  readonly label: string
  readonly type: EntityType
  readonly relevance: number
}

const MAX_ENTITIES = 10
const MAX_ARTICLES = 10

const STOP_PHRASES = new Set([
  'A',
  'An',
  'And',
  'As',
  'At',
  'But',
  'For',
  'From',
  'How',
  'In',
  'On',
  'Or',
  'The',
  'This',
  'To',
  'What',
  'When',
  'Where',
  'Why',
])

// Most real names in news coverage are two words (Donald Trump, Kamala
// Harris). Allowing 3+ word person candidates let RSS headline chunks
// ("Trump Faces Charges", "NATO Leaders Meet") fall through as bogus
// person tags because they lack an explicit org/event/location signal.
const MAX_PERSON_WORDS = 2

// Keys are stored without a trailing period because canonicalLabel strips
// trailing punctuation before lookup. `U.S.` in the source text becomes
// `U.S` by the time we consult this map.
const ACRONYM_ALIASES = new Map<string, string>([
  ['EU', 'European Union'],
  ['U.N', 'United Nations'],
  ['UN', 'United Nations'],
  ['UK', 'United Kingdom'],
  ['U.K', 'United Kingdom'],
  ['US', 'United States'],
  ['U.S', 'United States'],
  ['USA', 'United States'],
  ['U.S.A', 'United States'],
])

const ORGANIZATION_ACRONYMS = new Set([
  'AP',
  'BBC',
  'CIA',
  'EU',
  'FBI',
  'FTC',
  'G7',
  'G20',
  'GOP',
  'MLB',
  'NASA',
  'NATO',
  'NBA',
  'NFL',
  'NPR',
  'SEC',
  'UN',
  'U.N',
  'WHO',
])

const LOCATION_NAMES = new Set([
  'Africa',
  'America',
  'Asia',
  'Beijing',
  'Britain',
  'Canada',
  'China',
  'England',
  'Europe',
  'France',
  'Germany',
  'Iran',
  'Israel',
  'Italy',
  'London',
  'Mexico',
  'Moscow',
  'New Delhi',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New Orleans',
  'New York',
  'New Zealand',
  'Paris',
  'Qatar',
  'Russia',
  'Spain',
  'Toronto',
  'Ukraine',
  'United Kingdom',
  'United States',
  'Washington',
])

const ORGANIZATION_WORDS = [
  'Administration',
  'Agency',
  'Association',
  'Bank',
  'Committee',
  'Company',
  'Congress',
  'Council',
  'Court',
  'Department',
  'Foundation',
  'Government',
  'Group',
  'House',
  'Institute',
  'Ministry',
  'Nations',
  'Parliament',
  'Party',
  'Pentagon',
  'Police',
  'Reuters',
  'Senate',
  'Union',
  'University',
]

const EVENT_WORDS = [
  'Cup',
  'Election',
  'Finals',
  'Games',
  'Olympics',
  'Summit',
  'War',
]

const TOPIC_KEYWORDS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Artificial Intelligence', ['ai', 'artificial intelligence']],
  ['Climate', ['climate', 'wildfire', 'emissions']],
  ['Economy', ['economy', 'inflation', 'market', 'stocks']],
  ['Elections', ['election', 'campaign', 'primary', 'vote']],
  ['Health', ['health', 'hospital', 'vaccine']],
  ['Immigration', ['immigration', 'border', 'migrant']],
  ['Technology', ['technology', 'software', 'chip', 'cyber']],
]

interface CandidateStats {
  readonly label: string
  readonly type: EntityType
  readonly articleIndexes: Set<number>
  count: number
  firstIndex: number
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function canonicalLabel(label: string): string {
  let normalized = normalizeWhitespace(label.replace(/[.,;:!?]+$/g, ''))
  // Strip leading stop-phrase words so "The U.S." canonicalizes to "U.S"
  // (and then to "United States" via alias), and "In Washington" to
  // "Washington". The proper-name regex greedily joins capitalized tokens
  // separated by whitespace, so a sentence-initial article can otherwise
  // glue itself onto a real entity.
  while (true) {
    const spaceIdx = normalized.indexOf(' ')
    if (spaceIdx === -1) break
    const firstWord = normalized.slice(0, spaceIdx)
    if (!STOP_PHRASES.has(firstWord)) break
    normalized = normalized.slice(spaceIdx + 1)
  }
  return ACRONYM_ALIASES.get(normalized) ?? normalized
}

function titleCaseLabel(label: string): string {
  if (/^[A-Z0-9.]{2,}$/.test(label)) return label
  return label
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function isStopPhrase(label: string): boolean {
  return STOP_PHRASES.has(label) || label.length < 2
}

function hasTokenMatch(label: string, vocabulary: readonly string[]): boolean {
  const tokens = label.split(' ')
  return vocabulary.some((word) => tokens.includes(word))
}

const LETTER_DIGIT_CODE = /^[A-Z]+\d+$/

function inferType(label: string): EntityType | null {
  // Direct-set membership checks cover known multi-word entries like
  // "New York" and "United States", so they run before the length cap.
  if (LOCATION_NAMES.has(label)) return 'location'
  if (ORGANIZATION_ACRONYMS.has(label)) return 'organization'
  // Letter+digit tokens (G7, G20, COP28, JP50) are conventionally used in
  // news as summit/conference/organization codes. Pattern-matching them
  // here avoids having to enumerate every yearly instance explicitly.
  if (LETTER_DIGIT_CODE.test(label)) return 'organization'
  const wordCount = label.split(' ').length
  // Title-cased runs longer than `MAX_PERSON_WORDS` are almost always
  // headline chunks (`Supreme Court Blocks New York Rule`, `Biden Meets
  // NATO Leaders`), never real entities. Drop them before the vocabulary
  // fallthrough so an embedded token like `Court` or `War` doesn't
  // promote the whole run to an organization/event tag.
  if (wordCount > MAX_PERSON_WORDS) return null
  if (hasTokenMatch(label, ORGANIZATION_WORDS)) return 'organization'
  if (hasTokenMatch(label, EVENT_WORDS)) return 'event'
  if (wordCount >= 2) return 'person'
  // Single-word proper names with no explicit signal (e.g. "Trump", "Apple")
  // are too ambiguous to tag deterministically — drop them rather than
  // mislabel them as locations or organizations.
  return null
}

function addCandidate(
  map: Map<string, CandidateStats>,
  labelRaw: string,
  typeRaw: EntityType | null,
  articleIndex: number,
  firstIndex: number
): void {
  const label = titleCaseLabel(canonicalLabel(labelRaw))
  if (isStopPhrase(label)) return

  const type = typeRaw ?? inferType(label)
  if (type === null) return

  const key = `${label.toLowerCase()}:${type}`
  const existing = map.get(key)
  if (existing) {
    existing.count += 1
    existing.articleIndexes.add(articleIndex)
    existing.firstIndex = Math.min(existing.firstIndex, firstIndex)
  } else {
    map.set(key, {
      label,
      type,
      count: 1,
      articleIndexes: new Set([articleIndex]),
      firstIndex,
    })
  }
}

function extractProperNameCandidates(text: string): Array<{ label: string; index: number }> {
  const matches: Array<{ label: string; index: number }> = []
  // Token alternatives (order matters — JS alternation picks the first
  // matching branch, so letter+digit forms must come before the plain
  // multi-letter branch or "COP28" truncates to "COP").
  //   [A-Z][a-z]+                    — "Biden", "Washington"
  //   [A-Z]+\d+                      — "G7", "G20", "COP28"
  //   [A-Z]{2,}(?:\.[A-Z]+)*\.?      — "NATO", "U.N"
  //   [A-Z](?:\.[A-Z])+\.?           — "U.S", "U.K"
  //   \d+[A-Z]?                      — "3M", "1440"
  const pattern = /\b(?:[A-Z][a-z]+|[A-Z]+\d+|[A-Z]{2,}(?:\.[A-Z]+)*\.?|[A-Z](?:\.[A-Z])+\.?|\d+[A-Z]?)(?:\s+(?:[A-Z][a-z]+|[A-Z]+\d+|[A-Z]{2,}(?:\.[A-Z]+)*\.?|[A-Z](?:\.[A-Z])+\.?|\d+[A-Z]?))*\b/g

  for (const match of text.matchAll(pattern)) {
    const startIndex = match.index ?? 0
    const raw = normalizeWhitespace(match[0])
    if (!raw) continue

    const words = raw.split(' ')
    const wordOffsets: number[] = []
    let offset = 0
    for (const word of words) {
      wordOffsets.push(offset)
      offset += word.length + 1
    }

    // Both passes funnel through safeEmit so that a single textual
    // occurrence (e.g., a standalone "NATO" match) cannot be pushed twice
    // and inflate its count. Dedup is scoped per regex match: distinct
    // occurrences in the text still get independent counts.
    const seenAtIndex = new Set<string>()
    const safeEmit = (label: string, atIndex: number): void => {
      if (!label || isStopPhrase(label)) return
      const key = `${label}@${atIndex}`
      if (seenAtIndex.has(key)) return
      seenAtIndex.add(key)
      matches.push({ label, index: atIndex })
    }

    // Pass 1: surface known acronyms and location/org tokens as standalone
    // candidates even when they sit inside a longer title-cased run. Guards
    // against RSS headlines ("Biden Meets NATO Leaders In Washington",
    // "Supreme Court Blocks New York Rule") that would otherwise collapse
    // into a single bogus person/org tag. Skip for single-word matches —
    // Pass 2 already emits the whole match, and running this pass would
    // double-count the same position.
    if (words.length > 1) {
      words.forEach((word, i) => {
        const bare = word.replace(/[.,;:!?]+$/g, '')
        if (
          ORGANIZATION_ACRONYMS.has(bare) ||
          LOCATION_NAMES.has(bare) ||
          ACRONYM_ALIASES.has(bare) ||
          LETTER_DIGIT_CODE.test(bare)
        ) {
          safeEmit(bare, startIndex + wordOffsets[i])
        }
      })
      // Multi-token locations (e.g. "New York", "United States") also need
      // to survive embedding inside a longer headline run.
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`
        if (LOCATION_NAMES.has(bigram)) {
          safeEmit(bigram, startIndex + wordOffsets[i])
        }
      }
    }

    // Pass 2: split the match at STOP_PHRASES boundaries so embedded
    // connectors (In, The, And, …) don't glue distinct entities together.
    const emitSub = (start: number, end: number): void => {
      if (end <= start) return
      safeEmit(words.slice(start, end).join(' '), startIndex + wordOffsets[start])
    }

    let subStart = 0
    for (let i = 0; i < words.length; i++) {
      if (STOP_PHRASES.has(words[i])) {
        emitSub(subStart, i)
        subStart = i + 1
      }
    }
    emitSub(subStart, words.length)
  }

  return matches
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractTopicCandidates(text: string): Array<{ label: string; index: number }> {
  const normalized = text.toLowerCase()
  const matches: Array<{ label: string; index: number }> = []

  for (const [label, keywords] of TOPIC_KEYWORDS) {
    let earliest: number | undefined
    for (const keyword of keywords) {
      // Word-boundary match so short keywords like "ai" don't fire inside
      // common words such as "said", "aid", or "campaign".
      const pattern = new RegExp(`\\b${escapeRegex(keyword)}\\b`)
      const hit = pattern.exec(normalized)
      if (hit && (earliest === undefined || hit.index < earliest)) {
        earliest = hit.index
      }
    }
    if (earliest !== undefined) {
      matches.push({ label, index: earliest })
    }
  }

  return matches
}

function scoreCandidate(candidate: CandidateStats, maxCount: number, totalArticles: number): number {
  const frequencyScore = maxCount > 0 ? candidate.count / maxCount : 0
  const spreadScore = totalArticles > 0 ? candidate.articleIndexes.size / totalArticles : 0
  const raw = 0.35 + frequencyScore * 0.4 + spreadScore * 0.25
  return Math.round(Math.min(raw, 1) * 100) / 100
}

/**
 * Extract entities from article titles/descriptions using the deterministic
 * rule-based pipeline.
 *
 * Three-state return contract (consumed by `upsertStoryTags`):
 *  - `null`        — "no signal"; preserve any existing story_tags rows.
 *                    Returned when input titles were non-empty but no
 *                    candidate entities survived filtering, so we can't
 *                    distinguish a genuine empty result from an extraction
 *                    miss. Also used when the caller has no input to score.
 *  - `[]`          — "explicitly empty"; clear existing story_tags. Only
 *                    returned when `articleTitles` is itself empty (the
 *                    caller is asking us to represent an empty story).
 *  - `[...]`       — replace existing story_tags with the returned set.
 */
export async function extractEntities(
  articleTitles: readonly string[],
  articleDescriptions: readonly (string | null)[]
): Promise<readonly ExtractedEntity[] | null> {
  if (articleTitles.length === 0) {
    return []
  }

  const cappedTitles = articleTitles.slice(0, MAX_ARTICLES)
  const cappedDescriptions = articleDescriptions.slice(0, MAX_ARTICLES)
  const candidates = new Map<string, CandidateStats>()

  cappedTitles.forEach((title, index) => {
    const description = cappedDescriptions[index]
    const text = description ? `${title}. ${description}` : title

    for (const match of extractProperNameCandidates(text)) {
      addCandidate(candidates, match.label, null, index, match.index)
    }
    for (const match of extractTopicCandidates(text)) {
      addCandidate(candidates, match.label, 'topic', index, match.index)
    }
  })

  const values = [...candidates.values()]
  // Non-empty input that yielded no candidates: return null so callers
  // preserve existing tags rather than wiping them on reprocess.
  if (values.length === 0) return null

  const maxCount = Math.max(...values.map((candidate) => candidate.count))
  return values
    .map((candidate) => ({
      label: candidate.label,
      type: candidate.type,
      relevance: scoreCandidate(candidate, maxCount, cappedTitles.length),
      count: candidate.count,
      sourceSpread: candidate.articleIndexes.size,
      firstIndex: candidate.firstIndex,
    }))
    .sort((a, b) =>
      b.relevance !== a.relevance
        ? b.relevance - a.relevance
        : b.sourceSpread !== a.sourceSpread
          ? b.sourceSpread - a.sourceSpread
          : b.count !== a.count
            ? b.count - a.count
            : a.firstIndex - b.firstIndex
    )
    .slice(0, MAX_ENTITIES)
    .map(({ label, type, relevance }) => ({ label, type, relevance }))
}
