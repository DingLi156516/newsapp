import { vi } from 'vitest'
import {
  noopStageEmitter,
  safeEmit,
  type StageEventEmitter,
} from '@/lib/pipeline/stage-events'

describe('noopStageEmitter', () => {
  it('returns a resolved promise with no side effects', async () => {
    const result = await noopStageEmitter({
      stage: 'embed',
      level: 'warn',
      eventType: 'noop_test',
    })
    expect(result).toBeUndefined()
  })

  it('accepts all optional fields without error', async () => {
    await expect(
      noopStageEmitter({
        stage: 'cluster',
        level: 'error',
        eventType: 'dlq_pushed',
        sourceId: 'src-1',
        provider: 'gemini',
        itemId: 'a-1',
        durationMs: 42,
        payload: { foo: 'bar' },
      })
    ).resolves.toBeUndefined()
  })
})

describe('safeEmit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards the event to the wrapped emitter', async () => {
    const inner: StageEventEmitter = vi.fn().mockResolvedValue(undefined)
    await safeEmit(inner, {
      stage: 'embed',
      level: 'warn',
      eventType: 'probe',
      payload: { k: 'v' },
    })
    expect(inner).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'embed',
        level: 'warn',
        eventType: 'probe',
        payload: { k: 'v' },
      })
    )
  })

  it('swallows a rejecting emitter so observability never stalls the pipeline', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rejecting: StageEventEmitter = vi
      .fn()
      .mockRejectedValue(new Error('db down'))

    await expect(
      safeEmit(rejecting, {
        stage: 'cluster',
        level: 'error',
        eventType: 'probe',
      })
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[stage-events] emitter threw'),
    )
    warnSpy.mockRestore()
  })

  it('swallows a synchronously throwing emitter', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const throwing = (() => {
      throw new Error('bad emitter')
    }) as unknown as StageEventEmitter

    await expect(
      safeEmit(throwing, {
        stage: 'assemble',
        level: 'warn',
        eventType: 'probe',
      })
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
