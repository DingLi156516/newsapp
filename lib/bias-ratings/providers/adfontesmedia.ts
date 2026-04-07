/**
 * lib/bias-ratings/providers/adfontesmedia.ts — Ad Fontes Media stub provider.
 *
 * Ad Fontes Media is a paid API — this module stubs the interface for future integration.
 *
 * Future numeric scale mapping (horizontal axis, -42 to +42):
 *   -42 to -28 → far-left
 *   -28 to -14 → left
 *   -14 to -6  → lean-left
 *   -6  to +6  → center
 *   +6  to +14 → lean-right
 *   +14 to +28 → right
 *   +28 to +42 → far-right
 *
 * Reliability scale (vertical axis, 0–64):
 *   56–64 → very-high
 *   40–56 → high
 *   24–40 → mixed
 *   16–24 → low
 *    0–16 → very-low
 */

import type { ProviderLookupResult } from '@/lib/bias-ratings/types'

export function lookupAdFontes(_sourceUrl: string): ProviderLookupResult {
  return { matched: false, rating: null, matchedOn: null }
}
