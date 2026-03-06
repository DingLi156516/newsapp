import { fetcher } from '@/lib/hooks/fetcher'

describe('fetcher', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns parsed JSON on success', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    } as Response)

    const result = await fetcher('/api/test')
    expect(result).toEqual({ data: 'test' })
  })

  it('throws on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    } as Response)

    await expect(fetcher('/api/test')).rejects.toThrow('API error 404: Not found')
  })

  it('throws on 500 response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal server error'),
    } as Response)

    await expect(fetcher('/api/test')).rejects.toThrow('API error 500')
  })
})
