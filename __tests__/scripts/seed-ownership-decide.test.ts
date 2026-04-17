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
import { decideAction, type ResolvedOwner, type SourceRow } from '@/scripts/seed-ownership-decide'

function makeResolved(overrides: Partial<ResolvedOwner> = {}): ResolvedOwner {
  return {
    qid: 'Q1',
    name: 'Resolved Owner',
    country: 'US',
    inception: null,
    instanceOf: ['Q891723'],
    hops: 0,
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
