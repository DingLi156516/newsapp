/**
 * Tests for scripts/seed-ownership-decide.ts — the pure action-decision
 * helper for the Wikidata ownership backfill. Specifically covers the three
 * cases raised in Codex adversarial-review finding #1:
 *
 *   1. unlinked-new-owner  → insert
 *   2. unlinked-existing-owner → insert (caller's ON CONFLICT handles dedupe)
 *   3. linked-match  → confirmed
 *   4. linked-mismatch (default) → mismatch (no UPDATE emitted)
 *   5. linked-mismatch (--allow-overwrite) → link, confidence=low
 */

import { describe, it, expect } from 'vitest'
import {
  bestStatement,
  compareStatements,
  decideAction,
  deriveConfidence,
  type ResolvedOwner,
  type SourceRow,
  type Statement,
} from '@/scripts/seed-ownership-decide'

function makeResolved(overrides: Partial<ResolvedOwner> = {}): ResolvedOwner {
  return {
    qid: 'Q1',
    name: 'Resolved Owner',
    country: 'US',
    inception: null,
    instanceOf: ['Q891723'],
    hops: 0,
    property: 'P127',
    ...overrides,
  }
}

function makeSource(overrides: Partial<SourceRow> = {}): SourceRow {
  return {
    id: 'src-1',
    slug: 'example',
    name: 'Example',
    wikidata_qid: 'Q100',
    owner_id: null,
    ...overrides,
  }
}

describe('decideAction', () => {
  it('emits insert when source has no existing owner link', () => {
    const decision = decideAction({
      source: makeSource({ owner_id: null }),
      resolved: makeResolved(),
      allowOverwrite: false,
      baseConfidence: 'high',
    })
    expect(decision.action).toBe('insert')
    expect(decision.confidence).toBe('high')
  })

  it('carries walked-hops note when resolver required parent walking', () => {
    const decision = decideAction({
      source: makeSource({ owner_id: null }),
      resolved: makeResolved({ hops: 2 }),
      allowOverwrite: false,
      baseConfidence: 'medium',
    })
    expect(decision.action).toBe('insert')
    expect(decision.notes).toContain('Walked 2 P127 hops')
  })

  it('emits confirmed when existing owner QID matches resolved QID', () => {
    const decision = decideAction({
      source: makeSource({
        owner_id: 'owner-1',
        owner: {
          id: 'owner-1',
          name: 'Existing Owner',
          slug: 'existing',
          wikidata_qid: 'Q1',
          owner_source: 'manual',
        },
      }),
      resolved: makeResolved({ qid: 'Q1' }),
      allowOverwrite: false,
      baseConfidence: 'high',
    })
    expect(decision.action).toBe('confirmed')
    expect(decision.notes).toContain('matches Wikidata')
  })

  it('emits mismatch (no overwrite) when existing owner differs from resolved', () => {
    const decision = decideAction({
      source: makeSource({
        owner_id: 'owner-1',
        owner: {
          id: 'owner-1',
          name: 'Existing Owner',
          slug: 'existing',
          wikidata_qid: 'Q999',
          owner_source: 'manual',
        },
      }),
      resolved: makeResolved({ qid: 'Q1', name: 'Wikidata Owner' }),
      allowOverwrite: false,
      baseConfidence: 'high',
    })
    expect(decision.action).toBe('mismatch')
    expect(decision.confidence).toBe('low')
    expect(decision.notes).toContain('Existing Owner')
    expect(decision.notes).toContain('Q999')
    expect(decision.notes).toContain('--allow-overwrite')
  })

  it('emits mismatch when existing owner has no QID (unknown vs Wikidata)', () => {
    const decision = decideAction({
      source: makeSource({
        owner_id: 'owner-1',
        owner: {
          id: 'owner-1',
          name: 'Legacy Owner',
          slug: 'legacy',
          wikidata_qid: null,
          owner_source: 'manual',
        },
      }),
      resolved: makeResolved(),
      allowOverwrite: false,
      baseConfidence: 'high',
    })
    expect(decision.action).toBe('mismatch')
    expect(decision.confidence).toBe('low')
  })

  it('emits link with low confidence when --allow-overwrite is passed', () => {
    const decision = decideAction({
      source: makeSource({
        owner_id: 'owner-1',
        owner: {
          id: 'owner-1',
          name: 'Curated Owner',
          slug: 'curated',
          wikidata_qid: 'Q999',
          owner_source: 'manual',
        },
      }),
      resolved: makeResolved({ qid: 'Q1', name: 'New Owner' }),
      allowOverwrite: true,
      baseConfidence: 'high',
    })
    expect(decision.action).toBe('link')
    expect(decision.confidence).toBe('low')
    expect(decision.notes).toContain('Overwriting')
    expect(decision.notes).toContain('Curated Owner')
  })
})

describe('deriveConfidence', () => {
  it('P127 at hop 0 is high confidence', () => {
    expect(deriveConfidence(0, 'P127')).toBe('high')
  })

  it('P127 at hop 1 is medium confidence', () => {
    expect(deriveConfidence(1, 'P127')).toBe('medium')
  })

  it('P127 at hop 2+ is low confidence', () => {
    expect(deriveConfidence(2, 'P127')).toBe('low')
    expect(deriveConfidence(3, 'P127')).toBe('low')
  })

  it('P749 at hop 0 is medium confidence (one tier below P127)', () => {
    expect(deriveConfidence(0, 'P749')).toBe('medium')
  })

  it('P749 at hop 1+ is low confidence', () => {
    expect(deriveConfidence(1, 'P749')).toBe('low')
    expect(deriveConfidence(2, 'P749')).toBe('low')
  })

  it('P123 at hop 0 is medium confidence (matches P749 tier)', () => {
    expect(deriveConfidence(0, 'P123')).toBe('medium')
  })

  it('P123 at hop 1+ is low confidence', () => {
    expect(deriveConfidence(1, 'P123')).toBe('low')
  })
})

describe('bestStatement / compareStatements', () => {
  const preferredP127: Statement = { property: 'P127', rank: 'preferred' }
  const preferredP749: Statement = { property: 'P749', rank: 'preferred' }
  const preferredP123: Statement = { property: 'P123', rank: 'preferred' }
  const normalP127: Statement = { property: 'P127', rank: 'normal' }
  const normalP749: Statement = { property: 'P749', rank: 'normal' }

  it('picks preferred rank over normal regardless of property strength', () => {
    // A preferred P749 beats a normal P127 — preferred rank is load-bearing
    // and must not be crossed with property strength from a different
    // statement on the same owner.
    expect(bestStatement([normalP127, preferredP749])).toEqual(preferredP749)
  })

  it('uses property strength to break ties within preferred rank', () => {
    expect(bestStatement([preferredP749, preferredP127])).toEqual(preferredP127)
    expect(bestStatement([preferredP123, preferredP749])).toEqual(preferredP749)
  })

  it('uses property strength to break ties within normal rank', () => {
    expect(bestStatement([normalP749, normalP127])).toEqual(normalP127)
  })

  it('compareStatements returns 0 for identical statements', () => {
    expect(compareStatements(preferredP127, preferredP127)).toBe(0)
  })

  it('compareStatements prefers preferred over normal even when normal has stronger property', () => {
    // normalP127 has the stronger property but preferredP749 should win.
    expect(compareStatements(preferredP749, normalP127)).toBeLessThan(0)
    expect(compareStatements(normalP127, preferredP749)).toBeGreaterThan(0)
  })

  it('preserves per-statement coupling — mixed claims on one owner do not merge', () => {
    // Simulating a group with both preferredP749 and normalP127 statements.
    // The best statement is preferredP749 (a real single claim), NOT a
    // synthesized "preferred + P127" that would falsely inflate confidence.
    const mixedGroup: readonly Statement[] = [preferredP749, normalP127]
    const best = bestStatement(mixedGroup)
    expect(best).toEqual(preferredP749)
    expect(best.property).toBe('P749')
    expect(best.rank).toBe('preferred')
  })
})
