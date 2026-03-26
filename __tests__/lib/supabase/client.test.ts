vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    auth: {},
  })),
}))

describe('getSupabaseBrowserClient', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const { getSupabaseBrowserClient: freshClient } = await import('@/lib/supabase/client')
    expect(() => freshClient()).toThrow('Missing Supabase environment variables')
  })

  it('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const { getSupabaseBrowserClient: freshClient } = await import('@/lib/supabase/client')
    expect(() => freshClient()).toThrow('Missing Supabase environment variables')
  })

  it('returns a Supabase client when env vars are set', async () => {
    const { getSupabaseBrowserClient: freshClient } = await import('@/lib/supabase/client')
    const client = freshClient()
    expect(client).toBeDefined()
    expect(client.from).toBeDefined()
  })

  it('returns the same singleton instance on subsequent calls', async () => {
    const { getSupabaseBrowserClient: freshClient } = await import('@/lib/supabase/client')
    const client1 = freshClient()
    const client2 = freshClient()
    expect(client1).toBe(client2)
  })
})
