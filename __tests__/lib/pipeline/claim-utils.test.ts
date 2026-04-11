import { describe, it, expect, vi } from 'vitest'
import { runOwnerScopedUpdate } from '@/lib/pipeline/claim-utils'

function makeClient(opts: {
  updateError?: { message: string }
  updateCount: number | null
  verifyData?: { clustering_claim_owner: string | null } | null
  verifyError?: { message: string }
}) {
  const verifyMaybeSingle = vi.fn().mockResolvedValue({
    data: opts.verifyData ?? null,
    error: opts.verifyError ?? null,
  })
  const verifyEq = vi.fn().mockReturnValue({ maybeSingle: verifyMaybeSingle })
  const verifySelect = vi.fn().mockReturnValue({ eq: verifyEq })

  const ownerEq = vi.fn().mockResolvedValue({
    error: opts.updateError ?? null,
    count: opts.updateCount,
  })
  const idEq = vi.fn().mockReturnValue({ eq: ownerEq })
  const update = vi.fn().mockReturnValue({ eq: idEq })

  const from = vi.fn().mockReturnValue({ update, select: verifySelect })
  // Expose the spies so individual tests can assert on call shape
  // (e.g., that .update was invoked with { count: 'exact' } and the
  // owner-scoped chain .eq('id', …).eq(ownerColumn, owner)).
  return { from, _spies: { update, idEq, ownerEq, verifySelect, verifyEq } }
}

describe('runOwnerScopedUpdate', () => {
  it('returns outcome=applied when update matched one row', async () => {
    const client = makeClient({ updateCount: 1 })
    const outcome = await runOwnerScopedUpdate(client as never, {
      table: 'articles',
      id: 'a1',
      owner: 'owner-A',
      ownerColumn: 'clustering_claim_owner',
      payload: { clustering_claimed_at: null, clustering_claim_owner: null },
    })
    expect(outcome.kind).toBe('applied')

    // Phase 10 Codex Round 1 Fix 5: assert the owner-scoped chain
    // shape so a future regression that drops `{ count: 'exact' }`
    // or the second `.eq(ownerColumn, owner)` fails loud here.
    // Expected call shape:
    //   .update(payload, { count: 'exact' })
    //     .eq('id', id)
    //     .eq(ownerColumn, owner)
    const { update, idEq, ownerEq } = client._spies
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ clustering_claim_owner: null }),
      { count: 'exact' }
    )
    expect(idEq).toHaveBeenCalledWith('id', 'a1')
    expect(ownerEq).toHaveBeenCalledWith('clustering_claim_owner', 'owner-A')
  })

  it('returns outcome=ownership_moved when update count=0 and verify shows different owner', async () => {
    const client = makeClient({
      updateCount: 0,
      verifyData: { clustering_claim_owner: 'owner-B' },
    })
    const outcome = await runOwnerScopedUpdate(client as never, {
      table: 'articles',
      id: 'a1',
      owner: 'owner-A',
      ownerColumn: 'clustering_claim_owner',
      payload: { clustering_claimed_at: null, clustering_claim_owner: null },
    })
    expect(outcome.kind).toBe('ownership_moved')
  })

  it('returns outcome=row_missing when update count=0 and verify read returns null', async () => {
    const client = makeClient({ updateCount: 0, verifyData: null })
    const outcome = await runOwnerScopedUpdate(client as never, {
      table: 'articles',
      id: 'a1',
      owner: 'owner-A',
      ownerColumn: 'clustering_claim_owner',
      payload: { clustering_claimed_at: null, clustering_claim_owner: null },
    })
    expect(outcome.kind).toBe('row_missing')
  })

  it('returns outcome=policy_drift when update count=0 but verify shows claim still ours', async () => {
    const client = makeClient({
      updateCount: 0,
      verifyData: { clustering_claim_owner: 'owner-A' },
    })
    const outcome = await runOwnerScopedUpdate(client as never, {
      table: 'articles',
      id: 'a1',
      owner: 'owner-A',
      ownerColumn: 'clustering_claim_owner',
      payload: { clustering_claimed_at: null, clustering_claim_owner: null },
    })
    expect(outcome.kind).toBe('policy_drift')
  })

  it('returns outcome=error when the update itself fails', async () => {
    const client = makeClient({
      updateCount: null,
      updateError: { message: 'DB down' },
    })
    const outcome = await runOwnerScopedUpdate(client as never, {
      table: 'articles',
      id: 'a1',
      owner: 'owner-A',
      ownerColumn: 'clustering_claim_owner',
      payload: { clustering_claimed_at: null, clustering_claim_owner: null },
    })
    expect(outcome.kind).toBe('error')
    if (outcome.kind === 'error') {
      expect(outcome.message).toContain('DB down')
    }
  })

  it('returns outcome=error when the update promise itself rejects', async () => {
    const rejecting = vi.fn().mockRejectedValue(new Error('socket closed'))
    const idEq = vi.fn().mockReturnValue({ eq: rejecting })
    const update = vi.fn().mockReturnValue({ eq: idEq })
    const client = { from: vi.fn().mockReturnValue({ update, select: vi.fn() }) }

    const outcome = await runOwnerScopedUpdate(client as never, {
      table: 'articles',
      id: 'a1',
      owner: 'owner-A',
      ownerColumn: 'clustering_claim_owner',
      payload: { clustering_claimed_at: null, clustering_claim_owner: null },
    })
    expect(outcome.kind).toBe('error')
    if (outcome.kind === 'error') {
      expect(outcome.message).toContain('socket closed')
    }
  })
})
