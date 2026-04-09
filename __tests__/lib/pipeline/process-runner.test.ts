import { describe, it, expect, vi } from 'vitest'
import { runProcessPipeline } from '@/lib/pipeline/process-runner'

describe('runProcessPipeline', () => {
  it('prioritizes freshness stages before assembly under tight budget', async () => {
    let nowMs = 0
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
      nowMs += 50_000
      return { totalProcessed: 100, claimedArticles: 100, errors: [] }
    })

    const cluster = vi.fn().mockImplementation(async () => {
      callOrder.push('cluster')
      nowMs += 20_000
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

    expect(callOrder).toContain('cluster')
    expect(callOrder).toContain('embed')
    expect(callOrder).not.toContain('assemble')
    expect(callOrder.indexOf('embed')).toBeLessThan(callOrder.indexOf('cluster'))
    expect(cluster).toHaveBeenCalledTimes(1)
    expect(assemble).not.toHaveBeenCalled()
    expect(embed).toHaveBeenCalledTimes(1)
    expect(summary.clustering.passes).toBe(1)
    expect(summary.assembly.skipped).toBe(true)
    expect(summary.assembly.skipReason).toBe('budget_reserved_for_freshness')
    expect(summary.embeddings.passes).toBe(1)
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

  it('refreshes backlog after clustering progress before deciding whether embeddings can run', async () => {
    let nowMs = 0
    const countBacklog = vi
      .fn()
      .mockResolvedValueOnce({
        unembeddedArticles: 500,
        unclusteredArticles: 120,
        pendingAssemblyStories: 0,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 500,
        unclusteredArticles: 20,
        pendingAssemblyStories: 5,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 500,
        unclusteredArticles: 20,
        pendingAssemblyStories: 5,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 500,
        unclusteredArticles: 20,
        pendingAssemblyStories: 5,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })

    const embed = vi.fn().mockResolvedValue({
      totalProcessed: 100,
      claimedArticles: 100,
      errors: [],
    })
    const cluster = vi.fn().mockImplementation(async () => {
      nowMs += 90_000
      return {
        newStories: 1,
        updatedStories: 0,
        assignedArticles: 100,
        expiredArticles: 0,
        promotedSingletons: 0,
        unmatchedSingletons: 0,
        errors: [],
      }
    })
    const assemble = vi.fn()

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

    expect(cluster).toHaveBeenCalledTimes(2)
    expect(embed).toHaveBeenCalledTimes(1)
    expect(summary.backlog.after.pendingAssemblyStories).toBe(5)
    expect(summary.embeddings.skipped).toBe(false)
    expect(summary.embeddings.skipReason).toBeNull()
  })

  it('reserves time for clustering by default before running another embed pass', async () => {
    let nowMs = 0
    const countBacklog = vi
      .fn()
      .mockResolvedValueOnce({
        unembeddedArticles: 500,
        unclusteredArticles: 200,
        pendingAssemblyStories: 0,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 400,
        unclusteredArticles: 200,
        pendingAssemblyStories: 0,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 400,
        unclusteredArticles: 50,
        pendingAssemblyStories: 0,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })

    const embed = vi.fn().mockImplementation(async () => {
      nowMs += 80_000
      return { totalProcessed: 100, claimedArticles: 100, errors: [] }
    })
    const cluster = vi.fn().mockImplementation(async () => {
      nowMs += 10_000
      return {
        newStories: 1,
        updatedStories: 0,
        assignedArticles: 150,
        expiredArticles: 0,
        promotedSingletons: 0,
        unmatchedSingletons: 0,
        errors: [],
      }
    })
    const assemble = vi.fn().mockResolvedValue({
      storiesProcessed: 0,
      claimedStories: 0,
      autoPublished: 0,
      sentToReview: 0,
      errors: [],
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
        embedTarget: 200,
        clusterTarget: 200,
        assembleTarget: 0,
        embedBatchSize: 100,
        clusterBatchSize: 200,
        assembleBatchSize: 0,
        timeBudgetMs: 100_000,
      }
    )

    expect(embed).toHaveBeenCalledTimes(1)
    expect(cluster).toHaveBeenCalledTimes(2)
    expect(summary.embeddings.passes).toBe(1)
  })

  it('allows assembly alongside freshness when budget is ample', async () => {
    let nowMs = 0
    const countBacklog = vi
      .fn()
      .mockResolvedValueOnce({
        unembeddedArticles: 200,
        unclusteredArticles: 0,
        pendingAssemblyStories: 10,
        reviewQueueStories: 4,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 100,
        unclusteredArticles: 0,
        pendingAssemblyStories: 10,
        reviewQueueStories: 4,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 100,
        unclusteredArticles: 0,
        pendingAssemblyStories: 0,
        reviewQueueStories: 4,
        expiredArticles: 0,
      })

    const embed = vi.fn().mockImplementation(async () => {
      nowMs += 10_000
      return { totalProcessed: 100, claimedArticles: 100, errors: [] }
    })
    const cluster = vi.fn()
    const assemble = vi.fn().mockImplementation(async () => {
      nowMs += 5_000
      return {
        storiesProcessed: 10,
        claimedStories: 10,
        autoPublished: 8,
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
    expect(cluster).not.toHaveBeenCalled()
    expect(assemble).toHaveBeenCalledTimes(1)
    expect(summary.assembly.skipped).toBe(false)
    expect(summary.assembly.storiesProcessed).toBe(10)
  })

  it('defers assembly when freshness backlog exists and budget is tight', async () => {
    let nowMs = 0
    const countBacklog = vi
      .fn()
      .mockResolvedValueOnce({
        unembeddedArticles: 200,
        unclusteredArticles: 0,
        pendingAssemblyStories: 10,
        reviewQueueStories: 4,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 100,
        unclusteredArticles: 0,
        pendingAssemblyStories: 10,
        reviewQueueStories: 4,
        expiredArticles: 0,
      })

    const embed = vi.fn().mockImplementation(async () => {
      nowMs += 65_000
      return { totalProcessed: 100, claimedArticles: 100, errors: [] }
    })
    const cluster = vi.fn()
    const assemble = vi.fn()

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
    expect(cluster).not.toHaveBeenCalled()
    expect(assemble).not.toHaveBeenCalled()
    expect(summary.assembly.skipped).toBe(true)
    expect(summary.assembly.skipReason).toBe('budget_reserved_for_freshness')
  })

  it('reports concurrentMode: false in telemetry by default', async () => {
    const countBacklog = vi.fn().mockResolvedValue({
      unembeddedArticles: 0,
      unclusteredArticles: 0,
      pendingAssemblyStories: 0,
      reviewQueueStories: 0,
      expiredArticles: 0,
    })
    const embed = vi.fn()
    const cluster = vi.fn()
    const assemble = vi.fn()

    const summary = await runProcessPipeline({
      countBacklog,
      embed,
      cluster,
      assemble,
    })

    expect(summary.telemetry.concurrentMode).toBe(false)
  })

  it('runs embed and cluster concurrently when concurrentStages is true', async () => {
    let nowMs = 0
    const callOrder: string[] = []
    const countBacklog = vi
      .fn()
      .mockResolvedValueOnce({
        unembeddedArticles: 100,
        unclusteredArticles: 50,
        pendingAssemblyStories: 5,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 0,
        pendingAssemblyStories: 5,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 0,
        pendingAssemblyStories: 0,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })

    const embed = vi.fn().mockImplementation(async () => {
      callOrder.push('embed')
      nowMs += 30_000
      return { totalProcessed: 100, claimedArticles: 100, cacheHits: 0, errors: [] }
    })
    const cluster = vi.fn().mockImplementation(async () => {
      callOrder.push('cluster')
      nowMs += 10_000
      return {
        newStories: 2,
        updatedStories: 0,
        assignedArticles: 50,
        expiredArticles: 0,
        promotedSingletons: 0,
        unmatchedSingletons: 0,
        errors: [],
      }
    })
    const assemble = vi.fn().mockImplementation(async () => {
      callOrder.push('assemble')
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
        clusterTarget: 50,
        assembleTarget: 5,
        embedBatchSize: 100,
        clusterBatchSize: 50,
        assembleBatchSize: 5,
        timeBudgetMs: 200_000,
        concurrentStages: true,
      }
    )

    expect(embed).toHaveBeenCalledTimes(1)
    expect(cluster).toHaveBeenCalledTimes(1)
    expect(assemble).toHaveBeenCalledTimes(1)
    expect(summary.telemetry.concurrentMode).toBe(true)
    expect(summary.embeddings.skipped).toBe(false)
    expect(summary.clustering.skipped).toBe(false)
    expect(summary.assembly.skipped).toBe(false)

    // Assembly runs after both embed and cluster
    const assembleIdx = callOrder.indexOf('assemble')
    expect(assembleIdx).toBe(2)
  })

  it('sequential mode unchanged when concurrentStages is false', async () => {
    let nowMs = 0
    const callOrder: string[] = []
    const countBacklog = vi
      .fn()
      .mockResolvedValueOnce({
        unembeddedArticles: 100,
        unclusteredArticles: 50,
        pendingAssemblyStories: 0,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 50,
        pendingAssemblyStories: 0,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 0,
        pendingAssemblyStories: 0,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })

    const embed = vi.fn().mockImplementation(async () => {
      callOrder.push('embed')
      nowMs += 10_000
      return { totalProcessed: 100, claimedArticles: 100, cacheHits: 0, errors: [] }
    })
    const cluster = vi.fn().mockImplementation(async () => {
      callOrder.push('cluster')
      nowMs += 10_000
      return {
        newStories: 1,
        updatedStories: 0,
        assignedArticles: 50,
        expiredArticles: 0,
        promotedSingletons: 0,
        unmatchedSingletons: 0,
        errors: [],
      }
    })
    const assemble = vi.fn()

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
        clusterTarget: 50,
        assembleTarget: 0,
        embedBatchSize: 100,
        clusterBatchSize: 50,
        assembleBatchSize: 0,
        timeBudgetMs: 100_000,
        concurrentStages: false,
      }
    )

    expect(callOrder).toEqual(['embed', 'cluster'])
    expect(callOrder.indexOf('embed')).toBeLessThan(callOrder.indexOf('cluster'))
    expect(summary.telemetry.concurrentMode).toBe(false)
  })

  it('assembly waits for parallel embed+cluster phase to complete', async () => {
    let nowMs = 0
    const callOrder: string[] = []
    const countBacklog = vi
      .fn()
      .mockResolvedValueOnce({
        unembeddedArticles: 50,
        unclusteredArticles: 50,
        pendingAssemblyStories: 5,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 0,
        pendingAssemblyStories: 5,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 0,
        pendingAssemblyStories: 0,
        reviewQueueStories: 0,
        expiredArticles: 0,
      })

    const embed = vi.fn().mockImplementation(async () => {
      callOrder.push('embed')
      nowMs += 20_000
      return { totalProcessed: 50, claimedArticles: 50, cacheHits: 0, errors: [] }
    })
    const cluster = vi.fn().mockImplementation(async () => {
      callOrder.push('cluster')
      nowMs += 10_000
      return {
        newStories: 1,
        updatedStories: 0,
        assignedArticles: 50,
        expiredArticles: 0,
        promotedSingletons: 0,
        unmatchedSingletons: 0,
        errors: [],
      }
    })
    const assemble = vi.fn().mockImplementation(async () => {
      callOrder.push('assemble')
      nowMs += 5_000
      return {
        storiesProcessed: 5,
        claimedStories: 5,
        autoPublished: 3,
        sentToReview: 2,
        errors: [],
      }
    })

    await runProcessPipeline(
      {
        countBacklog,
        embed,
        cluster,
        assemble,
        now: () => nowMs,
      },
      {
        embedTarget: 50,
        clusterTarget: 50,
        assembleTarget: 5,
        embedBatchSize: 50,
        clusterBatchSize: 50,
        assembleBatchSize: 5,
        timeBudgetMs: 200_000,
        concurrentStages: true,
      }
    )

    const assembleIdx = callOrder.indexOf('assemble')
    const embedIdx = callOrder.indexOf('embed')
    const clusterIdx = callOrder.indexOf('cluster')
    expect(assembleIdx).toBeGreaterThan(embedIdx)
    expect(assembleIdx).toBeGreaterThan(clusterIdx)
  })
})
