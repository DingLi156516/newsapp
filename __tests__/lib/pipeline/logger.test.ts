import { PipelineLogger } from '@/lib/pipeline/logger'

describe('PipelineLogger', () => {
  const mockEq = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockSingle = vi.fn()
  const mockSelect = vi.fn(() => ({ single: mockSingle }))
  const mockInsert = vi.fn(() => ({ select: mockSelect }))
  const mockUpdate = vi.fn(() => ({ eq: mockEq }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockClient: any = {
    from: vi.fn(() => ({
      insert: mockInsert,
      update: mockUpdate,
    })),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSingle.mockResolvedValue({
      data: { id: 'run-abc-123' },
      error: null,
    })
  })

  describe('startRun', () => {
    it('creates a pipeline_runs row and returns a runId', async () => {
      const logger = new PipelineLogger(mockClient)
      const runId = await logger.startRun('ingest', 'cron')

      expect(runId).toBe('run-abc-123')
      expect(logger.getRunId()).toBe('run-abc-123')
      expect(mockClient.from).toHaveBeenCalledWith('pipeline_runs')
      expect(mockInsert).toHaveBeenCalledWith({
        run_type: 'ingest',
        triggered_by: 'cron',
        status: 'running',
      })
      expect(mockSelect).toHaveBeenCalledWith('id')
      expect(mockSingle).toHaveBeenCalled()
    })

    it('throws when insert fails', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'insert failed' },
      })

      const logger = new PipelineLogger(mockClient)

      await expect(logger.startRun('full', 'admin:u1')).rejects.toThrow(
        'Failed to create pipeline run: insert failed'
      )
    })

    it('throws when no data is returned', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null })

      const logger = new PipelineLogger(mockClient)

      await expect(logger.startRun('process', 'admin:u1')).rejects.toThrow(
        'Failed to create pipeline run: no data returned'
      )
    })
  })

  describe('logStep', () => {
    it('wraps async functions and records timing and result', async () => {
      const logger = new PipelineLogger(mockClient)
      await logger.startRun('ingest', 'cron')

      const stepResult = { articlesIngested: 42 }
      const result = await logger.logStep('ingest_feeds', async () => stepResult)

      expect(result).toEqual(stepResult)

      const steps = logger.getSteps()
      expect(steps).toHaveLength(1)
      expect(steps[0].step).toBe('ingest_feeds')
      expect(steps[0].status).toBe('success')
      expect(steps[0].duration_ms).toBeGreaterThanOrEqual(0)
      expect(steps[0].result).toEqual(stepResult)
      expect(steps[0].error).toBeUndefined()
    })

    it('captures errors and re-throws them', async () => {
      const logger = new PipelineLogger(mockClient)
      await logger.startRun('process', 'cron')

      const error = new Error('Embedding failed')

      await expect(
        logger.logStep('embed', async () => {
          throw error
        })
      ).rejects.toThrow('Embedding failed')

      const steps = logger.getSteps()
      expect(steps).toHaveLength(1)
      expect(steps[0].step).toBe('embed')
      expect(steps[0].status).toBe('error')
      expect(steps[0].error).toBe('Embedding failed')
      expect(steps[0].duration_ms).toBeGreaterThanOrEqual(0)
    })
  })

  describe('complete', () => {
    it('updates the row with status=completed, steps, summary, duration', async () => {
      const logger = new PipelineLogger(mockClient)
      await logger.startRun('full', 'admin:u1')

      await logger.logStep('ingest_feeds', async () => ({ count: 5 }))

      const summary = { totalArticles: 5 }
      await logger.complete(summary)

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          completed_at: expect.any(String),
          duration_ms: expect.any(Number),
          steps: expect.arrayContaining([
            expect.objectContaining({ step: 'ingest_feeds', status: 'success' }),
          ]),
          summary,
        })
      )
      expect(mockEq).toHaveBeenCalledWith('id', 'run-abc-123')
    })

    it('throws when run has not been started', async () => {
      const logger = new PipelineLogger(mockClient)

      await expect(logger.complete({})).rejects.toThrow(
        'Cannot complete a run that has not been started'
      )
    })
  })

  describe('fail', () => {
    it('updates the row with status=failed, error message, partial steps', async () => {
      const logger = new PipelineLogger(mockClient)
      await logger.startRun('full', 'admin:u1')

      try {
        await logger.logStep('embed', async () => {
          throw new Error('GPU out of memory')
        })
      } catch {
        // expected
      }

      await logger.fail('GPU out of memory')

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          completed_at: expect.any(String),
          duration_ms: expect.any(Number),
          steps: expect.arrayContaining([
            expect.objectContaining({ step: 'embed', status: 'error' }),
          ]),
          error: 'GPU out of memory',
        })
      )
      expect(mockEq).toHaveBeenCalledWith('id', 'run-abc-123')
    })

    it('throws when run has not been started', async () => {
      const logger = new PipelineLogger(mockClient)

      await expect(logger.fail('something broke')).rejects.toThrow(
        'Cannot fail a run that has not been started'
      )
    })
  })

  describe('stageEvent', () => {
    function makeStageEventClient(
      insertResult: { error: { message: string } | null } | Promise<never> = { error: null }
    ) {
      const insertSpy = vi.fn().mockImplementation(() => {
        if (insertResult instanceof Promise) return insertResult
        return Promise.resolve(insertResult)
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client: any = {
        from: vi.fn(() => ({ insert: insertSpy })),
      }
      return { client, insertSpy }
    }

    it('inserts a row against pipeline_stage_events with all fields populated', async () => {
      const { client, insertSpy } = makeStageEventClient()
      const logger = new PipelineLogger(client)

      await logger.stageEvent('run-1', 'owner-1', {
        stage: 'embed',
        level: 'warn',
        eventType: 'pgvector_fallback',
        sourceId: 'src-1',
        provider: 'gemini',
        itemId: 'article-1',
        durationMs: 250,
        payload: { reason: 'timeout' },
      })

      expect(client.from).toHaveBeenCalledWith('pipeline_stage_events')
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          run_id: 'run-1',
          claim_owner: 'owner-1',
          stage: 'embed',
          source_id: 'src-1',
          provider: 'gemini',
          level: 'warn',
          event_type: 'pgvector_fallback',
          item_id: 'article-1',
          duration_ms: 250,
          payload: { reason: 'timeout' },
        })
      )
    })

    it('defaults optional fields to null and payload to {}', async () => {
      const { client, insertSpy } = makeStageEventClient()
      const logger = new PipelineLogger(client)

      await logger.stageEvent('run-2', null, {
        stage: 'cluster',
        level: 'error',
        eventType: 'cleanup_fallback_failed',
      })

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          run_id: 'run-2',
          claim_owner: null,
          stage: 'cluster',
          source_id: null,
          provider: null,
          level: 'error',
          event_type: 'cleanup_fallback_failed',
          item_id: null,
          duration_ms: null,
          payload: {},
        })
      )
    })

    it('swallows DB errors — never throws from an observability hook', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { client } = makeStageEventClient({ error: { message: 'boom' } })
      const logger = new PipelineLogger(client)

      await expect(
        logger.stageEvent('run-3', 'owner-3', {
          stage: 'assemble',
          level: 'error',
          eventType: 'dlq_pushed',
        })
      ).resolves.toBeUndefined()

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('stageEvent persist failed')
      )
      warnSpy.mockRestore()
    })

    it('swallows thrown exceptions', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client: any = {
        from: vi.fn(() => ({
          insert: vi.fn(() => {
            throw new Error('network down')
          }),
        })),
      }
      const logger = new PipelineLogger(client)

      await expect(
        logger.stageEvent('run-4', 'owner-4', {
          stage: 'recluster',
          level: 'warn',
          eventType: 'pgvector_fallback',
        })
      ).resolves.toBeUndefined()

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('stageEvent threw')
      )
      warnSpy.mockRestore()
    })
  })

  describe('makeStageEmitter', () => {
    it('returns a function that forwards to stageEvent with pre-bound runId + owner', async () => {
      const insertSpy = vi.fn().mockResolvedValue({ error: null })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client: any = {
        from: vi.fn(() => ({ insert: insertSpy })),
      }
      const logger = new PipelineLogger(client)

      const emitter = logger.makeStageEmitter('run-bound', 'owner-bound')

      await emitter({
        stage: 'embed',
        level: 'error',
        eventType: 'dlq_pushed',
        itemId: 'article-z',
        payload: { retryCount: 3 },
      })

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          run_id: 'run-bound',
          claim_owner: 'owner-bound',
          stage: 'embed',
          level: 'error',
          event_type: 'dlq_pushed',
          item_id: 'article-z',
          payload: { retryCount: 3 },
        })
      )
    })
  })
})
