import { isAllowedByRobots, clearRobotsCache } from '@/lib/crawler/robots'

beforeEach(() => {
  clearRobotsCache()
  vi.restoreAllMocks()
})

describe('isAllowedByRobots', () => {
  it('returns true when robots.txt allows the URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('User-agent: *\nAllow: /', { status: 200 })
    )

    const result = await isAllowedByRobots('https://example.com/article')
    expect(result).toBe(true)
  })

  it('returns false when robots.txt disallows the URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('User-agent: *\nDisallow: /article', { status: 200 })
    )

    const result = await isAllowedByRobots('https://example.com/article/123')
    expect(result).toBe(false)
  })

  it('returns false (fail-closed) when robots.txt fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'))

    const result = await isAllowedByRobots('https://example.com/page')
    expect(result).toBe(false)
  })

  it('returns true when robots.txt returns clean 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 })
    )

    const result = await isAllowedByRobots('https://example.com/page')
    expect(result).toBe(true)
  })

  it('returns false (fail-closed) on 5xx error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 503 })
    )

    const result = await isAllowedByRobots('https://example.com/page')
    expect(result).toBe(false)
  })

  it('returns false for URLs targeting private networks', async () => {
    const result = await isAllowedByRobots('https://127.0.0.1/page')
    expect(result).toBe(false)
  })

  it('caches robots.txt per domain', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('User-agent: *\nAllow: /', { status: 200 })
    )

    await isAllowedByRobots('https://example.com/page1')
    await isAllowedByRobots('https://example.com/page2')

    // Only one fetch for robots.txt
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
