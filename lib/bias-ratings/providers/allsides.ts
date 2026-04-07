/**
 * lib/bias-ratings/providers/allsides.ts — AllSides bias rating dataset provider.
 *
 * Loads bundled AllSides JSON dataset and normalizes ratings to our scale.
 * AllSides uses a 5-point scale (no far-left/far-right). No factuality data.
 */

import type { BiasCategory } from '@/lib/types'
import type { ProviderLookupResult } from '@/lib/bias-ratings/types'
import { normalizeDomain } from '@/lib/bias-ratings/normalize-domain'
import allsidesData from '@/lib/bias-ratings/datasets/allsides.json'

interface AllSidesEntry {
  readonly name: string
  readonly url: string
  readonly bias: string
}

const BIAS_MAP: Record<string, BiasCategory | null> = {
  'left': 'left',
  'lean-left': 'lean-left',
  'center': 'center',
  'lean-right': 'lean-right',
  'right': 'right',
}

let domainIndex: Map<string, AllSidesEntry> | null = null

function getIndex(): Map<string, AllSidesEntry> {
  if (!domainIndex) {
    domainIndex = new Map()
    for (const entry of allsidesData as AllSidesEntry[]) {
      const domain = normalizeDomain(entry.url)
      if (domain) {
        domainIndex.set(domain, entry)
      }
    }
  }
  return domainIndex
}

export function normalizeAllSidesBias(allsidesBias: string): BiasCategory | null {
  return BIAS_MAP[allsidesBias] ?? null
}

export function lookupAllSides(sourceUrl: string): ProviderLookupResult {
  const domain = normalizeDomain(sourceUrl)
  const index = getIndex()
  const entry = index.get(domain)

  if (!entry) {
    return { matched: false, rating: null, matchedOn: null }
  }

  const bias = normalizeAllSidesBias(entry.bias)

  if (bias === null) {
    return { matched: false, rating: null, matchedOn: null }
  }

  return {
    matched: true,
    rating: { provider: 'allsides', bias, factuality: null },
    matchedOn: domain,
  }
}
