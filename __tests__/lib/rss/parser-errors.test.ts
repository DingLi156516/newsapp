import { categorizeFeedError } from '@/lib/rss/parser'

describe('categorizeFeedError', () => {
  describe('timeout errors', () => {
    it('categorizes ETIMEDOUT as timeout', () => {
      const result = categorizeFeedError(new Error('connect ETIMEDOUT 1.2.3.4'))
      expect(result.type).toBe('timeout')
      expect(result.message).toContain('ETIMEDOUT')
    })

    it('categorizes ESOCKETTIMEDOUT as timeout', () => {
      const result = categorizeFeedError(new Error('ESOCKETTIMEDOUT'))
      expect(result.type).toBe('timeout')
    })

    it('categorizes AbortError as timeout', () => {
      const result = categorizeFeedError(new Error('AbortError: The operation was aborted'))
      expect(result.type).toBe('timeout')
    })
  })

  describe('DNS errors', () => {
    it('categorizes ENOTFOUND as dns_error', () => {
      const result = categorizeFeedError(new Error('getaddrinfo ENOTFOUND example.com'))
      expect(result.type).toBe('dns_error')
      expect(result.message).toContain('ENOTFOUND')
    })

    it('categorizes EAI_AGAIN as dns_error', () => {
      const result = categorizeFeedError(new Error('getaddrinfo EAI_AGAIN example.com'))
      expect(result.type).toBe('dns_error')
    })
  })

  describe('HTTP errors', () => {
    it('categorizes 403 status as http_error', () => {
      const result = categorizeFeedError(new Error('Status code 403'))
      expect(result.type).toBe('http_error')
    })

    it('categorizes 404 status as http_error', () => {
      const result = categorizeFeedError(new Error('Status code 404'))
      expect(result.type).toBe('http_error')
    })

    it('categorizes 429 status as http_error', () => {
      const result = categorizeFeedError(new Error('Status code 429'))
      expect(result.type).toBe('http_error')
    })

    it('categorizes 500 status as http_error', () => {
      const result = categorizeFeedError(new Error('Status code 500'))
      expect(result.type).toBe('http_error')
    })
  })

  describe('parse errors', () => {
    it('categorizes XML parse errors as parse_error', () => {
      const cases = [
        'Non-whitespace before first tag',
        'Unexpected close tag',
        'Invalid XML',
        'not well-formed',
      ]

      for (const msg of cases) {
        const result = categorizeFeedError(new Error(msg))
        expect(result.type).toBe('parse_error')
      }
    })
  })

  describe('unknown errors', () => {
    it('categorizes unrecognized errors as unknown', () => {
      const result = categorizeFeedError(new Error('Something completely unexpected'))
      expect(result.type).toBe('unknown')
      expect(result.message).toBe('Something completely unexpected')
    })
  })

  describe('non-Error values', () => {
    it('categorizes string timeout errors correctly', () => {
      const result = categorizeFeedError('ETIMEDOUT connection failed')
      expect(result.type).toBe('timeout')
      expect(result.message).toBe('ETIMEDOUT connection failed')
    })

    it('categorizes string DNS errors correctly', () => {
      const result = categorizeFeedError('ENOTFOUND badhost.com')
      expect(result.type).toBe('dns_error')
    })

    it('categorizes unknown strings as unknown', () => {
      const result = categorizeFeedError('some random string')
      expect(result.type).toBe('unknown')
      expect(result.message).toBe('some random string')
    })
  })
})
