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

  // =========================================================================
  // Phase 13A — batch-tuner live wiring via optional getStageDurations dep
  // =========================================================================

  describe('batch-tuner wiring (Phase 13A)', () => {
    const backlog = {
      unembeddedArticles: 100,
      unclusteredArticles: 100,
      pendingAssemblyStories: 0,
      reviewQueueStories: 0,
      expiredArticles: 0,
    }

    it('falls back to resolved.embedBatchSize when getStageDurations is omitted (back-compat)', async () => {
      // Use persistent backlog so both stages still run after refresh.
      const countBacklog = vi.fn().mockResolvedValue(backlog)
      const embed = vi
        .fn()
        .mockResolvedValueOnce({ totalProcessed: 77, claimedArticles: 77, errors: [] })
        .mockResolvedValue({ totalProcessed: 0, claimedArticles: 0, errors: [] })
      const cluster = vi
        .fn()
        .mockResolvedValueOnce({
          newStories: 1,
          updatedStories: 0,
          assignedArticles: 88,
          unmatchedSingletons: 0,
          promotedSingletons: 0,
          expiredArticles: 0,
          errors: [],
        })
        .mockResolvedValue({
          newStories: 0,
          updatedStories: 0,
          assignedArticles: 0,
          unmatchedSingletons: 0,
          promotedSingletons: 0,
          expiredArticles: 0,
          errors: [],
        })
      const assemble = vi.fn()

      await runProcessPipeline(
        { countBacklog, embed, cluster, assemble },
        {
          embedTarget: 500,
          clusterTarget: 500,
          assembleTarget: 0,
          embedBatchSize: 77,
          clusterBatchSize: 88,
          assembleBatchSize: 5,
          timeBudgetMs: 100_000,
        }
      )

      // Without the tuner, the runner must pass the resolved ceiling verbatim.
      expect(embed).toHaveBeenCalledWith(77)
      expect(cluster).toHaveBeenCalledWith(88)
    })

    it('uses the ceiling when getStageDurations returns empty arrays (no_history)', async () => {
      const biggerBacklog = {
        unembeddedArticles: 500,
        unclusteredArticles: 500,
        pendingAssemblyStories: 0,
        reviewQueueStories: 0,
        expiredArticles: 0,
      }
      const countBacklog = vi.fn().mockResolvedValue(biggerBacklog)
      const embed = vi
        .fn()
        .mockResolvedValueOnce({ totalProcessed: 150, claimedArticles: 150, errors: [] })
        .mockResolvedValue({ totalProcessed: 0, claimedArticles: 0, errors: [] })
      const cluster = vi
        .fn()
        .mockResolvedValueOnce({
          newStories: 1,
          updatedStories: 0,
          assignedArticles: 200,
          unmatchedSingletons: 0,
          promotedSingletons: 0,
          expiredArticles: 0,
          errors: [],
        })
        .mockResolvedValue({
          newStories: 0,
          updatedStories: 0,
          assignedArticles: 0,
          unmatchedSingletons: 0,
          promotedSingletons: 0,
          expiredArticles: 0,
          errors: [],
        })
      const assemble = vi.fn()
      const getStageDurations = vi.fn().mockResolvedValue({
        embed: [],
        cluster: [],
        assemble: [],
      })
      const emitStageEvent = vi.fn().mockResolvedValue(undefined)

      await runProcessPipeline(
        {
          countBacklog,
          embed,
          cluster,
          assemble,
          getStageDurations,
          emitStageEvent,
        },
        {
          embedTarget: 1000,
          clusterTarget: 1000,
          assembleTarget: 0,
          embedBatchSize: 150,
          clusterBatchSize: 200,
          assembleBatchSize: 25,
          timeBudgetMs: 100_000,
        }
      )

      expect(getStageDurations).toHaveBeenCalledTimes(1)
      // With no history, the recommendation keeps previousBatch=ceiling, so
      // effective batch is the ceiling.
      expect(embed).toHaveBeenCalledWith(150)
      expect(cluster).toHaveBeenCalledWith(200)

      // The tuner must have emitted a batch_tuner_recommendation event per
      // stage whose getStageDurations bucket is present. At minimum embed
      // + cluster (assemble is skipped because target=0). Reason=no_history.
      const events = emitStageEvent.mock.calls.map((call) => call[0])
      const embedRec = events.find(
        (e) =>
          e.eventType === 'batch_tuner_recommendation' &&
          (e.payload as { stage?: string }).stage === 'embed'
      )
      expect(embedRec).toBeDefined()
      expect(embedRec?.level).toBe('info')
      expect((embedRec?.payload as { reason?: string }).reason).toBe('no_history')
      expect((embedRec?.payload as { recommendedBatch?: number }).recommendedBatch).toBe(150)
    })

    it('shrinks the effective batch size when recent durations exceed the stage budget', async () => {
      const countBacklog = vi
        .fn()
        .mockResolvedValueOnce(backlog)
        .mockResolvedValueOnce({ ...backlog, unembeddedArticles: 0, unclusteredArticles: 0 })
      const embed = vi
        .fn()
        .mockResolvedValue({ totalProcessed: 30, claimedArticles: 30, errors: [] })
      const cluster = vi
        .fn()
        .mockResolvedValue({
          newStories: 1,
          updatedStories: 0,
          assignedArticles: 30,
          unmatchedSingletons: 0,
          promotedSingletons: 0,
          expiredArticles: 0,
          errors: [],
        })
      const assemble = vi.fn()

      // Embed budget target is 15_000ms — feeding 45s per pass triggers
      // over_budget shrink. Shrink ratio ≈ 15/45 → 0.33.
      // previousBatch 150 * 0.33 = 50 (floor). floor >= STAGE_BUDGETS.embed.min (25).
      const getStageDurations = vi.fn().mockResolvedValue({
        embed: [45_000, 45_000, 45_000],
        cluster: [],
        assemble: [],
      })
      const emitStageEvent = vi.fn().mockResolvedValue(undefined)

      await runProcessPipeline(
        {
          countBacklog,
          embed,
          cluster,
          assemble,
          getStageDurations,
          emitStageEvent,
        },
        {
          embedTarget: 200,
          clusterTarget: 200,
          assembleTarget: 0,
          embedBatchSize: 150, // ceiling
          clusterBatchSize: 200,
          assembleBatchSize: 25,
          timeBudgetMs: 100_000,
        }
      )

      // The effective embed batch must be shrunk — strictly less than the ceiling.
      expect(embed).toHaveBeenCalledTimes(1)
      const firstEmbedArg = embed.mock.calls[0][0] as number
      expect(firstEmbedArg).toBeLessThan(150)
      expect(firstEmbedArg).toBeGreaterThanOrEqual(25) // floor

      const events = emitStageEvent.mock.calls.map((call) => call[0])
      const embedRec = events.find(
        (e) =>
          e.eventType === 'batch_tuner_recommendation' &&
          (e.payload as { stage?: string }).stage === 'embed'
      )
      expect(embedRec).toBeDefined()
      expect((embedRec?.payload as { reason?: string }).reason).toBe('over_budget')
      expect((embedRec?.payload as { recommendedBatch?: number }).recommendedBatch).toBe(
        firstEmbedArg
      )
    })

    it('never exceeds resolved.embedBatchSize ceiling even if recommender suggests a larger value', async () => {
      // Use an artificially low ceiling. The tuner would normally grow
      // to STAGE_BUDGETS.embed.ceiling = 200, but the caller's ceiling is
      // lower and must pin the cap.
      const countBacklog = vi
        .fn()
        .mockResolvedValueOnce(backlog)
        .mockResolvedValueOnce({ ...backlog, unembeddedArticles: 0, unclusteredArticles: 0 })
      const embed = vi
        .fn()
        .mockResolvedValue({ totalProcessed: 50, claimedArticles: 50, errors: [] })
      const cluster = vi
        .fn()
        .mockResolvedValue({
          newStories: 1,
          updatedStories: 0,
          assignedArticles: 50,
          unmatchedSingletons: 0,
          promotedSingletons: 0,
          expiredArticles: 0,
          errors: [],
        })
      const assemble = vi.fn()
      const getStageDurations = vi.fn().mockResolvedValue({
        embed: [2_000, 2_000, 2_000], // very fast → would grow
        cluster: [],
        assemble: [],
      })

      await runProcessPipeline(
        {
          countBacklog,
          embed,
          cluster,
          assemble,
          getStageDurations,
        },
        {
          embedTarget: 200,
          clusterTarget: 200,
          assembleTarget: 0,
          embedBatchSize: 50, // caller's ceiling
          clusterBatchSize: 200,
          assembleBatchSize: 25,
          timeBudgetMs: 100_000,
        }
      )

      // Effective batch can never exceed caller ceiling regardless of tuner.
      const firstEmbedArg = embed.mock.calls[0][0] as number
      expect(firstEmbedArg).toBeLessThanOrEqual(50)
    })

    it('does not fail the run when getStageDurations throws (best-effort)', async () => {
      const countBacklog = vi
        .fn()
        .mockResolvedValueOnce(backlog)
        .mockResolvedValueOnce({ ...backlog, unembeddedArticles: 0, unclusteredArticles: 0 })
      const embed = vi
        .fn()
        .mockResolvedValue({ totalProcessed: 50, claimedArticles: 50, errors: [] })
      const cluster = vi
        .fn()
        .mockResolvedValue({
          newStories: 1,
          updatedStories: 0,
          assignedArticles: 50,
          unmatchedSingletons: 0,
          promotedSingletons: 0,
          expiredArticles: 0,
          errors: [],
        })
      const assemble = vi.fn()
      const getStageDurations = vi
        .fn()
        .mockRejectedValue(new Error('audit table unreachable'))

      const summary = await runProcessPipeline(
        {
          countBacklog,
          embed,
          cluster,
          assemble,
          getStageDurations,
        },
        {
          embedTarget: 100,
          clusterTarget: 100,
          assembleTarget: 0,
          embedBatchSize: 77,
          clusterBatchSize: 88,
          assembleBatchSize: 5,
          timeBudgetMs: 100_000,
        }
      )

      // Fall back to the static ceiling if the tuner fails.
      expect(embed).toHaveBeenCalledWith(77)
      expect(summary.embeddings.totalProcessed).toBe(50)
    })
  })
})
