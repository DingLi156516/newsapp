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
})
