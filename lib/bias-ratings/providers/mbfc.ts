/**
 * lib/bias-ratings/providers/mbfc.ts — Media Bias/Fact Check dataset provider.
 *
 * Loads bundled MBFC JSON dataset and normalizes ratings to our scale.
 * Dataset sourced from drmikecrowe/mbfcext GitHub repo.
 */

import type { BiasCategory, FactualityLevel } from '@/lib/types'
import type { ProviderLookupResult } from '@/lib/bias-ratings/types'
import { normalizeDomain } from '@/lib/bias-ratings/normalize-domain'
import mbfcData from '@/lib/bias-ratings/datasets/mbfc.json'

interface MbfcEntry {
  readonly name: string
  readonly url: string
  readonly bias: string
  readonly factuality: string
}

const BIAS_MAP: Record<string, BiasCategory | null> = {
  'extreme-left': 'far-left',
  'left': 'left',
  'left-center': 'lean-left',
  'center': 'center',
  'pro-science': 'center',
  'right-center': 'lean-right',
  'right': 'right',
  'extreme-right': 'far-right',
  'questionable': null,
  'satire': null,
  'conspiracy-pseudoscience': null,
}

const FACTUALITY_MAP: Record<string, FactualityLevel | null> = {
  'very-high': 'very-high',
  'high': 'high',
  'mostly-factual': 'high',
  'mixed': 'mixed',
  'low': 'low',
  'very-low': 'very-low',
}

let domainIndex: Map<string, MbfcEntry> | null = null

function getIndex(): Map<string, MbfcEntry> {
  if (!domainIndex) {
    domainIndex = new Map()
    for (const entry of mbfcData as MbfcEntry[]) {
      const domain = normalizeDomain(entry.url)
      if (domain) {
        domainIndex.set(domain, entry)
      }
    }
  }
  return domainIndex
}

export function normalizeMbfcBias(mbfcBias: string): BiasCategory | null {
  return BIAS_MAP[mbfcBias] ?? null
}

export function normalizeMbfcFactuality(mbfcFactuality: string): FactualityLevel | null {
  return FACTUALITY_MAP[mbfcFactuality] ?? null
}

export function lookupMbfc(sourceUrl: string): ProviderLookupResult {
  const domain = normalizeDomain(sourceUrl)
  const index = getIndex()
  const entry = index.get(domain)

  if (!entry) {
    return { matched: false, rating: null, matchedOn: null }
  }

  // Skip unreliable categories entirely
  const SKIP_CATEGORIES = ['questionable', 'satire', 'conspiracy-pseudoscience']
  if (SKIP_CATEGORIES.includes(entry.bias)) {
    return { matched: false, rating: null, matchedOn: null }
  }

  const bias = normalizeMbfcBias(entry.bias)
  const factuality = normalizeMbfcFactuality(entry.factuality)

  return {
    matched: true,
    rating: { provider: 'mbfc', bias, factuality },
    matchedOn: domain,
  }
}
