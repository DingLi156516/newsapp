import { describe, it, expect, vi } from 'vitest'
import { runProcessPipeline } from '@/lib/pipeline/process-runner'

describe('runProcessPipeline freshness telemetry', () => {
  it('prioritizes embedding and clustering before assembly and reports throughput telemetry', async () => {
    const countBacklog = vi
      .fn()
      .mockResolvedValueOnce({
        unembeddedArticles: 40,
        unclusteredArticles: 10,
        pendingAssemblyStories: 5,
        reviewQueueStories: 0,
        expiredArticles: 0,
        oldestAgeMinutes: {
          unembeddedArticles: 30,
          unclusteredArticles: 20,
          pendingAssemblyStories: 10,
          reviewQueueStories: null,
          expiredArticles: null,
        },
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 10,
        pendingAssemblyStories: 5,
        reviewQueueStories: 0,
        expiredArticles: 0,
        oldestAgeMinutes: {
          unembeddedArticles: null,
          unclusteredArticles: 20,
          pendingAssemblyStories: 10,
          reviewQueueStories: null,
          expiredArticles: null,
        },
      })
      .mockResolvedValueOnce({
        unembeddedArticles: 0,
        unclusteredArticles: 0,
        pendingAssemblyStories: 5,
        reviewQueueStories: 0,
        expiredArticles: 0,
        oldestAgeMinutes: {
          unembeddedArticles: null,
          unclusteredArticles: null,
          pendingAssemblyStories: 10,
          reviewQueueStories: null,
          expiredArticles: null,
        },
      })
      .mockResolvedValue({
        unembeddedArticles: 0,
        unclusteredArticles: 0,
        pendingAssemblyStories: 0,
        reviewQueueStories: 0,
        expiredArticles: 0,
        oldestAgeMinutes: {
          unembeddedArticles: null,
          unclusteredArticles: null,
          pendingAssemblyStories: null,
          reviewQueueStories: null,
          expiredArticles: null,
        },
      })

    const callOrder: string[] = []
    let nowMs = 0

    const embed = vi.fn().mockImplementation(async () => {
      callOrder.push('embed')
      nowMs += 1_000
      return { totalProcessed: 40, claimedArticles: 40, errors: [], dbTimeMs: 250, modelTimeMs: 500 }
    })

    const cluster = vi.fn().mockImplementation(async () => {
      callOrder.push('cluster')
      nowMs += 2_000
      return {
        newStories: 2,
        updatedStories: 1,
        assignedArticles: 10,
        unmatchedSingletons: 0,
        promotedSingletons: 0,
        expiredArticles: 0,
        errors: [],
        dbTimeMs: 300,
      }
    })

    const assemble = vi.fn().mockImplementation(async () => {
      callOrder.push('assemble')
      nowMs += 3_000
      return {
        storiesProcessed: 5,
        claimedStories: 5,
        autoPublished: 4,
        sentToReview: 1,
        errors: [],
        dbTimeMs: 400,
        modelTimeMs: 900,
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
        embedTarget: 40,
        clusterTarget: 10,
        assembleTarget: 5,
        embedBatchSize: 40,
        clusterBatchSize: 10,
        assembleBatchSize: 5,
        timeBudgetMs: 60_000,
      }
    )

    expect(callOrder).toEqual(['embed', 'cluster', 'assemble'])
    expect(summary.telemetry.durationMs).toBe(6_000)
    expect(summary.telemetry.processedPerMinute).toBeGreaterThan(0)
    expect(summary.embeddings.processedPerMinute).toBeGreaterThan(0)
    expect(summary.clustering.processedPerMinute).toBeGreaterThan(0)
    expect(summary.assembly.processedPerMinute).toBeGreaterThan(0)
    expect(summary.backlog.before.oldestAgeMinutes?.unembeddedArticles).toBe(30)
  })
})
