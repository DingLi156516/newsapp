/**
 * lib/rss/url-validation.ts — Pure URL validation (no Node.js dependencies).
 *
 * Extracted from discover.ts so that client-side code (e.g., Zod schemas
 * in source-admin-validation.ts) can validate URLs without pulling in
 * `node:dns/promises` via the webpack bundle.
 */

const PRIVATE_IP_RANGES = [
  /^127\./,                    // 127.0.0.0/8
  /^10\./,                     // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,               // 192.168.0.0/16
  /^169\.254\./,               // 169.254.0.0/16 (link-local / AWS IMDS)
  /^0\./,                      // 0.0.0.0/8
]

const BLOCKED_HOSTNAMES = new Set(['localhost', '[::1]', '0.0.0.0', '[::]'])

const BLOCKED_IPV6_PREFIXES = [
  /^::$/,           // unspecified
  /^::1$/,          // loopback (without brackets)
  /^f[cd]/i,        // fc00::/7 unique local (fc.. and fd..)
  /^fe[89ab]/i,     // fe80::/10 link-local
]

/**
 * Extract the embedded IPv4 from an IPv4-mapped IPv6 address.
 * Node normalizes `::ffff:127.0.0.1` to `::ffff:7f00:1`, so we parse
 * the two trailing hex groups back to dotted-decimal.
 */
export function extractMappedIPv4(bare: string): string | null {
  const match = bare.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (!match) return null
  const hi = parseInt(match[1], 16)
  const lo = parseInt(match[2], 16)
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
}

/**
 * Synchronous SSRF guard that rejects URLs targeting private/reserved IPs.
 * Safe for client-side use — no Node.js APIs.
 */
export function validatePublicUrl(url: string): void {
  const parsed = new URL(url)

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL targets a private or reserved network address')
  }

  const hostname = parsed.hostname

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error('URL targets a private or reserved network address')
  }

  if (PRIVATE_IP_RANGES.some((re) => re.test(hostname))) {
    throw new Error('URL targets a private or reserved network address')
  }

  const bare = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname
  if (BLOCKED_IPV6_PREFIXES.some((re) => re.test(bare))) {
    throw new Error('URL targets a private or reserved network address')
  }

  const mappedIPv4 = extractMappedIPv4(bare)
  if (mappedIPv4 && PRIVATE_IP_RANGES.some((re) => re.test(mappedIPv4))) {
    throw new Error('URL targets a private or reserved network address')
  }
}

/**
 * Checks if a resolved IP address (v4 or v6) targets a private/reserved range.
 * Used by validatePublicUrlWithDns after DNS resolution.
 */
export function isPrivateAddress(address: string): boolean {
  if (BLOCKED_HOSTNAMES.has(address)) return true
  if (PRIVATE_IP_RANGES.some((re) => re.test(address))) return true
  if (BLOCKED_IPV6_PREFIXES.some((re) => re.test(address))) return true

  const mappedIPv4 = extractMappedIPv4(address)
  if (mappedIPv4 && PRIVATE_IP_RANGES.some((re) => re.test(mappedIPv4))) return true

  return false
}
