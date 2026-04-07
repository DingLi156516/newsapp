/**
 * lib/bias-ratings/normalize-domain.ts — Normalize URLs/domains for provider matching.
 *
 * Strips protocol, www prefix, trailing slashes, paths, and query params.
 * "https://www.cnn.com/news/" → "cnn.com"
 */

export function normalizeDomain(input: string): string {
  let domain = input.trim().toLowerCase()

  // Strip protocol
  domain = domain.replace(/^https?:\/\//, '')

  // Strip www. prefix
  domain = domain.replace(/^www\./, '')

  // Strip port number
  domain = domain.replace(/:\d+/, '')

  // Strip path, query, fragment
  const slashIndex = domain.indexOf('/')
  if (slashIndex !== -1) {
    domain = domain.slice(0, slashIndex)
  }

  const queryIndex = domain.indexOf('?')
  if (queryIndex !== -1) {
    domain = domain.slice(0, queryIndex)
  }

  const hashIndex = domain.indexOf('#')
  if (hashIndex !== -1) {
    domain = domain.slice(0, hashIndex)
  }

  // Strip trailing dots
  domain = domain.replace(/\.+$/, '')

  return domain
}
