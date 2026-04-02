import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('gemini-client model routing', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    } as Response))
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
  })

  it('passes an explicit model override to Gemini generation requests', async () => {
    const { generateText } = await import('@/lib/ai/gemini-client')

    await generateText('test prompt', { model: 'models/gemini-2.5-flash' })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse(init?.body as string)
    expect(body.model).toBe('models/gemini-2.5-flash')
  })
})
