/**
 * Tests for lib/pipeline/claim-utils.ts atomic claim helpers.
 *
 * These tests simulate two competing runners and assert that the DB-side
 * compare-and-set implemented in migration 037 only hands each row to one
 * owner. The Supabase client here is a minimal stub: we model the RPC server
 * as a shared bucket of "available" IDs and verify ownership partitioning.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  claimEmbeddingBatch,
  claimClusteringBatch,
  claimAssemblyBatch,
  generateClaimOwner,
  releaseEmbeddingClaim,
  releaseClusteringClaim,
  releaseAssemblyClaim,
} from '@/lib/pipeline/claim-utils'

/**
 * Build a minimal Supabase-style client whose `rpc` implements a single
 * shared bucket of available IDs. Any IDs returned by the first caller
 * are removed from the bucket, so a second caller of the same RPC cannot
 * claim them — this models the SECURITY DEFINER RPC semantics.
 */
function createSharedBucketClient(available: string[]) {
  const bucket = [...available]
  const claims = new Map<string, string>() // id → owner
  const released: string[] = []

  const rpc = vi.fn(
    (name: string, args: Record<string, unknown>) => {
      if (
        name === 'claim_articles_for_embedding' ||
        name === 'claim_articles_for_clustering' ||
        name === 'claim_stories_for_assembly'
      ) {
        const limit = (args.p_limit as number) ?? bucket.length
        const owner = args.p_owner as string
        const taken = bucket.splice(0, limit)
        for (const id of taken) {
          claims.set(id, owner)
        }
        return Promise.resolve({ data: taken, error: null })
      }
      if (
        name === 'release_embedding_claim' ||
        name === 'release_clustering_claim' ||
        name === 'release_assembly_claim'
      ) {
        const id = (args.p_article_id ?? args.p_story_id) as string
        const owner = args.p_owner as string
        if (claims.get(id) === owner) {
          claims.delete(id)
          bucket.push(id)
          released.push(id)
          return Promise.resolve({ data: true, error: null })
        }
        return Promise.resolve({ data: false, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }
  )

  return {
    rpc,
    _claims: claims,
    _released: released,
    _bucket: bucket,
  }
}

describe('atomic claim leases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateClaimOwner', () => {
    it('returns a unique UUID-shaped string per call', () => {
      const a = generateClaimOwner()
      const b = generateClaimOwner()
      expect(a).not.toBe(b)
      expect(a).toMatch(/^[0-9a-f-]{36}$/i)
      expect(b).toMatch(/^[0-9a-f-]{36}$/i)
    })
  })

  describe('claimEmbeddingBatch', () => {
    it('returns the IDs issued by the server RPC', async () => {
      const client = createSharedBucketClient(['a1', 'a2', 'a3'])
      const owner = generateClaimOwner()
      const ids = await claimEmbeddingBatch(client as never, owner, 3)
      expect(ids).toEqual(['a1', 'a2', 'a3'])
      expect(client.rpc).toHaveBeenCalledWith(
        'claim_articles_for_embedding',
        expect.objectContaining({
          p_owner: owner,
          p_limit: 3,
          p_ttl_seconds: expect.any(Number),
        })
      )
    })

    it('returns an empty array when the limit is 0', async () => {
      const client = createSharedBucketClient(['a1'])
      const ids = await claimEmbeddingBatch(client as never, generateClaimOwner(), 0)
      expect(ids).toEqual([])
      expect(client.rpc).not.toHaveBeenCalled()
    })

    it('throws on RPC error', async () => {
      const client = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }),
      }
      await expect(
        claimEmbeddingBatch(client as never, generateClaimOwner(), 5)
      ).rejects.toThrow('boom')
    })
  })

  describe('race behavior — two owners contending for the same rows', () => {
    it('claim_articles_for_embedding never hands the same row to two owners', async () => {
      const client = createSharedBucketClient(['a1', 'a2', 'a3', 'a4', 'a5'])
      const ownerA = generateClaimOwner()
      const ownerB = generateClaimOwner()

      // Simulate concurrent invocation.
      const [idsA, idsB] = await Promise.all([
        claimEmbeddingBatch(client as never, ownerA, 3),
        claimEmbeddingBatch(client as never, ownerB, 3),
      ])

      const combined = [...idsA, ...idsB]
      const unique = new Set(combined)
      expect(unique.size).toBe(combined.length)
      expect(combined.length).toBeLessThanOrEqual(5)
    })

    it('claim_articles_for_clustering never hands the same row to two owners', async () => {
      const client = createSharedBucketClient(['c1', 'c2', 'c3'])
      const ownerA = generateClaimOwner()
      const ownerB = generateClaimOwner()

      const [idsA, idsB] = await Promise.all([
        claimClusteringBatch(client as never, ownerA, 2),
        claimClusteringBatch(client as never, ownerB, 2),
      ])

      const combined = [...idsA, ...idsB]
      expect(new Set(combined).size).toBe(combined.length)
    })

    it('claim_stories_for_assembly never hands the same row to two owners', async () => {
      const client = createSharedBucketClient(['s1', 's2', 's3', 's4'])
      const ownerA = generateClaimOwner()
      const ownerB = generateClaimOwner()

      const [idsA, idsB] = await Promise.all([
        claimAssemblyBatch(client as never, ownerA, 2),
        claimAssemblyBatch(client as never, ownerB, 2),
      ])

      const combined = [...idsA, ...idsB]
      expect(new Set(combined).size).toBe(combined.length)
    })
  })

  describe('release is owner-scoped', () => {
    it('owner A cannot release a claim held by owner B', async () => {
      const client = createSharedBucketClient(['a1'])
      const ownerA = generateClaimOwner()
      const ownerB = generateClaimOwner()

      const idsA = await claimEmbeddingBatch(client as never, ownerA, 1)
      expect(idsA).toEqual(['a1'])

      // Owner B tries to release a row it does not own.
      await releaseEmbeddingClaim(client as never, 'a1', ownerB)

      // The row is still owned by A — not returned to the bucket.
      expect(client._claims.get('a1')).toBe(ownerA)
      expect(client._released).toEqual([])
    })

    it('clustering release is owner-scoped', async () => {
      const client = createSharedBucketClient(['c1'])
      const ownerA = generateClaimOwner()
      const ownerB = generateClaimOwner()

      await claimClusteringBatch(client as never, ownerA, 1)
      await releaseClusteringClaim(client as never, 'c1', ownerB)
      expect(client._released).toEqual([])

      await releaseClusteringClaim(client as never, 'c1', ownerA)
      expect(client._released).toEqual(['c1'])
    })

    it('assembly release is owner-scoped', async () => {
      const client = createSharedBucketClient(['s1'])
      const ownerA = generateClaimOwner()
      const ownerB = generateClaimOwner()

      await claimAssemblyBatch(client as never, ownerA, 1)
      await releaseAssemblyClaim(client as never, 's1', ownerB)
      expect(client._released).toEqual([])

      await releaseAssemblyClaim(client as never, 's1', ownerA)
      expect(client._released).toEqual(['s1'])
    })
  })
})
