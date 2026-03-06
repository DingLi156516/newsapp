vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    auth: {},
  })),
}))

describe('getSupabaseServerClient', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const { getSupabaseServerClient } = await import('@/lib/supabase/server')
    expect(() => getSupabaseServerClient()).toThrow('Missing required environment variable')
  })

  it('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const { getSupabaseServerClient } = await import('@/lib/supabase/server')
    expect(() => getSupabaseServerClient()).toThrow('Missing required environment variable')
  })

  it('returns a client when env vars are present', async () => {
    const { getSupabaseServerClient } = await import('@/lib/supabase/server')
    const client = getSupabaseServerClient()
    expect(client).toBeDefined()
    expect(client.from).toBeDefined()
  })

  it('creates a new client on each call (no singleton)', async () => {
    const { getSupabaseServerClient } = await import('@/lib/supabase/server')
    const client1 = getSupabaseServerClient()
    const client2 = getSupabaseServerClient()
    expect(client1).not.toBe(client2)
  })
})

describe('getSupabaseServiceClient', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { getSupabaseServiceClient } = await import('@/lib/supabase/server')
    expect(() => getSupabaseServiceClient()).toThrow('Missing required environment variable')
  })

  it('returns a client when all env vars are present', async () => {
    const { getSupabaseServiceClient } = await import('@/lib/supabase/server')
    const client = getSupabaseServiceClient()
    expect(client).toBeDefined()
    expect(client.from).toBeDefined()
  })
})
