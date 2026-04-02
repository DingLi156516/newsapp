import { describe, it, expect, vi } from 'vitest'
import { runProcessPipeline } from '@/lib/pipeline/process-runner'

describe('runProcessPipeline', () => {
  it('prioritizes freshness stages before assembly', async () => {
    const countBacklog = vi
      .fn()
      .mockResolvedValueOnce({
        unembeddedArticles: 1000,
        unclusteredArticles: 250,
        pendingAssemblyStories: 0,
        reviewQueueStories: 4,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 1000,
        unclusteredArticles: 150,
        pendingAssemblyStories: 2,
        reviewQueueStories: 4,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 900,
        unclusteredArticles: 0,
        pendingAssemblyStories: 2,
        reviewQueueStories: 5,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 900,
        unclusteredArticles: 0,
        pendingAssemblyStories: 0,
        reviewQueueStories: 5,
        expiredArticles: 0,
      })

    const callOrder: string[] = []
    const embed = vi.fn().mockImplementation(async () => {
      callOrder.push('embed')
      return { totalProcessed: 100, claimedArticles: 100, errors: [] }
    })

    const cluster = vi.fn().mockImplementation(async () => {
      callOrder.push('cluster')
      return {
        newStories: 1,
        updatedStories: 0,
        assignedArticles: 2,
        expiredArticles: 0,
        promotedSingletons: 0,
        unmatchedSingletons: 4,
        errors: [],
      }
    })

    const assemble = vi
      .fn()
      .mockImplementationOnce(async () => {
        callOrder.push('assemble')
        return {
          storiesProcessed: 2,
          claimedStories: 2,
          autoPublished: 1,
          sentToReview: 1,
          errors: [],
        }
      })
      .mockImplementation(async () => {
        callOrder.push('assemble')
        return {
          storiesProcessed: 0,
          claimedStories: 0,
          autoPublished: 0,
          sentToReview: 0,
          errors: [],
        }
      })

    const summary = await runProcessPipeline(
      {
        countBacklog,
        embed,
        cluster,
        assemble,
      },
      {
        embedTarget: 100,
        clusterTarget: 250,
        assembleTarget: 25,
        embedBatchSize: 100,
        clusterBatchSize: 250,
        assembleBatchSize: 25,
        timeBudgetMs: 100_000,
        clusterReserveMs: 25_000,
        assembleReserveMs: 15_000,
      }
    )

    expect(callOrder).toContain('cluster')
    expect(callOrder).toContain('assemble')
    expect(callOrder).toContain('embed')
    expect(callOrder.indexOf('embed')).toBeLessThan(callOrder.indexOf('cluster'))
    expect(callOrder.indexOf('cluster')).toBeLessThan(callOrder.indexOf('assemble'))
    expect(cluster).toHaveBeenCalledTimes(1)
    expect(assemble).toHaveBeenCalledTimes(1)
    expect(embed).toHaveBeenCalledTimes(1)
    expect(summary.clustering.passes).toBe(1)
    expect(summary.assembly.passes).toBe(1)
    expect(summary.embeddings.passes).toBe(1)
    expect(summary.assembly.autoPublished).toBe(1)
    expect(summary.assembly.sentToReview).toBe(1)
  })

  it('defers assembly until freshness backlog is drained', async () => {
    let nowMs = 0
    const countBacklog = vi
      .fn()
      .mockResolvedValueOnce({
        unembeddedArticles: 100,
        unclusteredArticles: 25,
        pendingAssemblyStories: 10,
        reviewQueueStories: 4,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 25,
        pendingAssemblyStories: 10,
        reviewQueueStories: 4,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 0,
        pendingAssemblyStories: 10,
        reviewQueueStories: 4,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 0,
        pendingAssemblyStories: 10,
        reviewQueueStories: 4,
        expiredArticles: 0,
      })

    const embed = vi.fn().mockImplementation(async () => {
      nowMs += 40_000
      return { totalProcessed: 100, claimedArticles: 100, errors: [] }
    })
    const cluster = vi.fn().mockImplementation(async () => {
      nowMs += 50_000
      return {
        newStories: 0,
        updatedStories: 1,
        assignedArticles: 25,
        expiredArticles: 0,
        promotedSingletons: 0,
        unmatchedSingletons: 3,
        errors: [],
      }
    })
    const assemble = vi.fn().mockImplementation(async () => {
      nowMs += 5_000
      return {
        storiesProcessed: 5,
        claimedStories: 5,
        autoPublished: 3,
        sentToReview: 2,
        errors: [],
      }
    })

    const summary = await runProcessPipeline(
      {
        countBacklog,
        embed,
        cluster,
        assemble,
        now: () => nowMs,
      },
      {
        embedTarget: 100,
        clusterTarget: 250,
        assembleTarget: 25,
        embedBatchSize: 100,
        clusterBatchSize: 250,
        assembleBatchSize: 25,
        timeBudgetMs: 100_000,
        clusterReserveMs: 25_000,
        assembleReserveMs: 15_000,
      }
    )

    expect(embed).toHaveBeenCalledTimes(1)
    expect(cluster).toHaveBeenCalledTimes(1)
    expect(assemble).toHaveBeenCalled()
    expect(summary.clustering.skipped).toBe(false)
    expect(summary.embeddings.skipped).toBe(false)
    expect(summary.assembly.skipped).toBe(false)
  })

  it('records no-backlog skip reasons for empty downstream stages', async () => {
    const countBacklog = vi
      .fn()
      .mockResolvedValueOnce({
        unembeddedArticles: 50,
        unclusteredArticles: 0,
        pendingAssemblyStories: 0,
        reviewQueueStories: 1,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 0,
        pendingAssemblyStories: 0,
        reviewQueueStories: 1,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 0,
        pendingAssemblyStories: 0,
        reviewQueueStories: 1,
        expiredArticles: 0,
      })

    const embed = vi
      .fn()
      .mockResolvedValueOnce({ totalProcessed: 50, claimedArticles: 50, errors: [] })
      .mockResolvedValue({ totalProcessed: 0, claimedArticles: 0, errors: [] })
    const cluster = vi.fn()
    const assemble = vi.fn()

    const summary = await runProcessPipeline(
      {
        countBacklog,
        embed,
        cluster,
        assemble,
      },
      {
        embedTarget: 100,
        clusterTarget: 250,
        assembleTarget: 25,
        embedBatchSize: 100,
        clusterBatchSize: 250,
        assembleBatchSize: 25,
        timeBudgetMs: 100_000,
        clusterReserveMs: 25_000,
        assembleReserveMs: 15_000,
      }
    )

    expect(cluster).not.toHaveBeenCalled()
    expect(assemble).not.toHaveBeenCalled()
    expect(summary.clustering.skipped).toBe(true)
    expect(summary.clustering.skipReason).toBe('no_backlog')
    expect(summary.assembly.skipped).toBe(true)
    expect(summary.assembly.skipReason).toBe('no_backlog')
    expect(summary.embeddings.skipped).toBe(false)
  })
})
