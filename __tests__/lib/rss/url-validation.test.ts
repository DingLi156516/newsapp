/**
 * Tests for lib/rss/url-validation.ts — SSRF guard and IP classification.
 *
 * Covers validatePublicUrl (scheme + private-IP rejection), isPrivateAddress
 * (IPv4, IPv6, mapped-IPv6, blocked hostnames), and extractMappedIPv4 parsing.
 */

import { describe, it, expect } from 'vitest'
import {
  validatePublicUrl,
  isPrivateAddress,
  extractMappedIPv4,
} from '@/lib/rss/url-validation'

/* ------------------------------------------------------------------ */
/*  validatePublicUrl                                                  */
/* ------------------------------------------------------------------ */
describe('validatePublicUrl', () => {
  const PRIVATE_ERROR = 'URL targets a private or reserved network address'

  describe('rejects loopback and reserved addresses', () => {
    it('rejects http://localhost', () => {
      expect(() => validatePublicUrl('http://localhost')).toThrow(PRIVATE_ERROR)
    })

    it('rejects http://127.0.0.1', () => {
      expect(() => validatePublicUrl('http://127.0.0.1')).toThrow(PRIVATE_ERROR)
    })

    it('rejects http://127.0.0.255 (full 127.x range)', () => {
      expect(() => validatePublicUrl('http://127.0.0.255')).toThrow(PRIVATE_ERROR)
    })

    it('rejects http://[::1]', () => {
      expect(() => validatePublicUrl('http://[::1]')).toThrow(PRIVATE_ERROR)
    })

    it('rejects http://0.0.0.0', () => {
      expect(() => validatePublicUrl('http://0.0.0.0')).toThrow(PRIVATE_ERROR)
    })

    it('rejects http://[::]', () => {
      expect(() => validatePublicUrl('http://[::]')).toThrow(PRIVATE_ERROR)
    })
  })

  describe('rejects RFC 1918 private ranges', () => {
    it('rejects http://10.0.0.1 (10.0.0.0/8)', () => {
      expect(() => validatePublicUrl('http://10.0.0.1')).toThrow(PRIVATE_ERROR)
    })

    it('rejects http://10.255.255.255 (10.0.0.0/8 upper)', () => {
      expect(() => validatePublicUrl('http://10.255.255.255')).toThrow(PRIVATE_ERROR)
    })

    it('rejects http://172.16.0.1 (172.16.0.0/12 lower)', () => {
      expect(() => validatePublicUrl('http://172.16.0.1')).toThrow(PRIVATE_ERROR)
    })

    it('rejects http://172.31.255.255 (172.16.0.0/12 upper)', () => {
      expect(() => validatePublicUrl('http://172.31.255.255')).toThrow(PRIVATE_ERROR)
    })

    it('rejects http://192.168.0.1 (192.168.0.0/16)', () => {
      expect(() => validatePublicUrl('http://192.168.0.1')).toThrow(PRIVATE_ERROR)
    })

    it('rejects http://192.168.255.255 (192.168.0.0/16 upper)', () => {
      expect(() => validatePublicUrl('http://192.168.255.255')).toThrow(PRIVATE_ERROR)
    })
  })

  describe('rejects link-local and IMDS', () => {
    it('rejects http://169.254.169.254 (AWS IMDS)', () => {
      expect(() => validatePublicUrl('http://169.254.169.254')).toThrow(PRIVATE_ERROR)
    })

    it('rejects http://169.254.0.1 (link-local)', () => {
      expect(() => validatePublicUrl('http://169.254.0.1')).toThrow(PRIVATE_ERROR)
    })
  })

  describe('rejects non-HTTP schemes', () => {
    it('rejects ftp://example.com', () => {
      expect(() => validatePublicUrl('ftp://example.com')).toThrow(PRIVATE_ERROR)
    })

    it('rejects file:///etc/passwd', () => {
      expect(() => validatePublicUrl('file:///etc/passwd')).toThrow(PRIVATE_ERROR)
    })

    it('rejects gopher://example.com', () => {
      expect(() => validatePublicUrl('gopher://example.com')).toThrow(PRIVATE_ERROR)
    })
  })

  describe('accepts valid public URLs', () => {
    it('accepts https://example.com/feed.xml', () => {
      expect(() => validatePublicUrl('https://example.com/feed.xml')).not.toThrow()
    })

    it('accepts http://example.com/rss', () => {
      expect(() => validatePublicUrl('http://example.com/rss')).not.toThrow()
    })

    it('accepts https://8.8.8.8/dns-query', () => {
      expect(() => validatePublicUrl('https://8.8.8.8/dns-query')).not.toThrow()
    })

    it('accepts https://feeds.reuters.com/news/world', () => {
      expect(() =>
        validatePublicUrl('https://feeds.reuters.com/news/world')
      ).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('throws on empty string (invalid URL)', () => {
      expect(() => validatePublicUrl('')).toThrow()
    })

    it('throws on malformed URL without scheme', () => {
      expect(() => validatePublicUrl('not-a-url')).toThrow()
    })

    it('rejects IPv4-mapped IPv6 loopback http://[::ffff:7f00:1]', () => {
      expect(() =>
        validatePublicUrl('http://[::ffff:7f00:1]')
      ).toThrow(PRIVATE_ERROR)
    })

    it('rejects IPv4-mapped IPv6 private http://[::ffff:a00:1] (10.0.0.1)', () => {
      expect(() =>
        validatePublicUrl('http://[::ffff:a00:1]')
      ).toThrow(PRIVATE_ERROR)
    })
  })
})

/* ------------------------------------------------------------------ */
/*  isPrivateAddress                                                   */
/* ------------------------------------------------------------------ */
describe('isPrivateAddress', () => {
  describe('returns true for blocked hostnames', () => {
    it('identifies localhost', () => {
      expect(isPrivateAddress('localhost')).toBe(true)
    })

    it('identifies [::1]', () => {
      expect(isPrivateAddress('[::1]')).toBe(true)
    })

    it('identifies 0.0.0.0', () => {
      expect(isPrivateAddress('0.0.0.0')).toBe(true)
    })

    it('identifies [::]', () => {
      expect(isPrivateAddress('[::]')).toBe(true)
    })
  })

  describe('returns true for private IPv4 ranges', () => {
    it('identifies 127.0.0.1', () => {
      expect(isPrivateAddress('127.0.0.1')).toBe(true)
    })

    it('identifies 10.0.0.1', () => {
      expect(isPrivateAddress('10.0.0.1')).toBe(true)
    })

    it('identifies 172.16.0.1', () => {
      expect(isPrivateAddress('172.16.0.1')).toBe(true)
    })

    it('identifies 192.168.1.1', () => {
      expect(isPrivateAddress('192.168.1.1')).toBe(true)
    })

    it('identifies 169.254.169.254', () => {
      expect(isPrivateAddress('169.254.169.254')).toBe(true)
    })

    it('identifies 0.0.0.0', () => {
      expect(isPrivateAddress('0.0.0.0')).toBe(true)
    })
  })

  describe('returns true for IPv6 loopback', () => {
    it('identifies ::1 (bare IPv6 loopback)', () => {
      expect(isPrivateAddress('::1')).toBe(true)
    })

    it('identifies :: (unspecified)', () => {
      expect(isPrivateAddress('::')).toBe(true)
    })
  })

  describe('returns true for IPv6 unique-local and link-local', () => {
    it('identifies fc00::1 (unique local fc)', () => {
      expect(isPrivateAddress('fc00::1')).toBe(true)
    })

    it('identifies fd12::1 (unique local fd)', () => {
      expect(isPrivateAddress('fd12::1')).toBe(true)
    })

    it('identifies fe80::1 (link-local)', () => {
      expect(isPrivateAddress('fe80::1')).toBe(true)
    })
  })

  describe('returns true for IPv4-mapped IPv6 private addresses', () => {
    it('identifies ::ffff:7f00:1 (mapped 127.0.0.1)', () => {
      expect(isPrivateAddress('::ffff:7f00:1')).toBe(true)
    })

    it('identifies ::ffff:a00:1 (mapped 10.0.0.1)', () => {
      expect(isPrivateAddress('::ffff:a00:1')).toBe(true)
    })

    it('identifies ::ffff:c0a8:101 (mapped 192.168.1.1)', () => {
      expect(isPrivateAddress('::ffff:c0a8:101')).toBe(true)
    })
  })

  describe('returns false for public addresses', () => {
    it('returns false for 8.8.8.8', () => {
      expect(isPrivateAddress('8.8.8.8')).toBe(false)
    })

    it('returns false for 1.1.1.1', () => {
      expect(isPrivateAddress('1.1.1.1')).toBe(false)
    })

    it('returns false for 93.184.216.34 (example.com)', () => {
      expect(isPrivateAddress('93.184.216.34')).toBe(false)
    })

    it('returns false for 2001:db8::1 (doc prefix, not in blocked list)', () => {
      expect(isPrivateAddress('2001:db8::1')).toBe(false)
    })
  })
})

/* ------------------------------------------------------------------ */
/*  extractMappedIPv4                                                  */
/* ------------------------------------------------------------------ */
describe('extractMappedIPv4', () => {
  it('parses ::ffff:7f00:1 to 127.0.0.1', () => {
    expect(extractMappedIPv4('::ffff:7f00:1')).toBe('127.0.0.1')
  })

  it('parses ::ffff:a00:1 to 10.0.0.1', () => {
    expect(extractMappedIPv4('::ffff:a00:1')).toBe('10.0.0.1')
  })

  it('parses ::ffff:c0a8:101 to 192.168.1.1', () => {
    expect(extractMappedIPv4('::ffff:c0a8:101')).toBe('192.168.1.1')
  })

  it('parses ::ffff:ac10:1 to 172.16.0.1', () => {
    expect(extractMappedIPv4('::ffff:ac10:1')).toBe('172.16.0.1')
  })

  it('parses ::ffff:808:808 to 8.8.8.8', () => {
    expect(extractMappedIPv4('::ffff:808:808')).toBe('8.8.8.8')
  })

  it('is case-insensitive (::FFFF:7f00:1)', () => {
    expect(extractMappedIPv4('::FFFF:7f00:1')).toBe('127.0.0.1')
  })

  describe('returns null for non-mapped addresses', () => {
    it('returns null for plain IPv4 (127.0.0.1)', () => {
      expect(extractMappedIPv4('127.0.0.1')).toBeNull()
    })

    it('returns null for IPv6 loopback (::1)', () => {
      expect(extractMappedIPv4('::1')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(extractMappedIPv4('')).toBeNull()
    })

    it('returns null for regular IPv6 address', () => {
      expect(extractMappedIPv4('2001:db8::1')).toBeNull()
    })

    it('returns null for dotted-decimal mapped format (::ffff:127.0.0.1)', () => {
      // The regex only handles the hex format, not dotted-decimal
      expect(extractMappedIPv4('::ffff:127.0.0.1')).toBeNull()
    })
  })
})
