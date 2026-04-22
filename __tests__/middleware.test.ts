/**
 * Tests for middleware.ts — telemetry session cookie + DNT signal.
 *
 * The full middleware function exercises Next's spec-extension internals
 * which are hard to stand up in a jsdom unit test. We test the extracted
 * pure helpers (decideSessionCookie + the constants) here; the integration
 * path is covered by Playwright in e2e/.
 */

import { describe, it, expect } from 'vitest'
import {
  decideSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
  DNT_RESPONSE_HEADER,
} from '@/middleware'

describe('decideSessionCookie', () => {
  it('mints a fresh UUID when no cookie exists', () => {
    const decision = decideSessionCookie(undefined, () => 'fresh-uuid')
    expect(decision.shouldSet).toBe(true)
    expect(decision.value).toBe('fresh-uuid')
  })

  it('mints a fresh UUID when cookie is empty string', () => {
    const decision = decideSessionCookie('', () => 'fresh-uuid')
    expect(decision.shouldSet).toBe(true)
    expect(decision.value).toBe('fresh-uuid')
  })

  it('reuses an existing cookie without rotating', () => {
    const decision = decideSessionCookie('existing-uuid', () => 'fresh-uuid')
    expect(decision.shouldSet).toBe(false)
    expect(decision.value).toBe('existing-uuid')
  })

  it('options carry httpOnly, SameSite=Lax, 7-day maxAge', () => {
    const { options } = decideSessionCookie(undefined, () => 'x')
    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe('lax')
    expect(options.path).toBe('/')
    expect(options.maxAge).toBe(SESSION_COOKIE_MAX_AGE)
    expect(SESSION_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 7)
  })

  it('secure flag is true only in production', () => {
    expect(decideSessionCookie(undefined, () => 'x', true).options.secure).toBe(true)
    expect(decideSessionCookie(undefined, () => 'x', false).options.secure).toBe(false)
  })

  it('uses the canonical cookie name', () => {
    expect(SESSION_COOKIE_NAME).toBe('axiom_session')
  })

  it('uses the canonical DNT response header name', () => {
    expect(DNT_RESPONSE_HEADER).toBe('x-axiom-dnt')
  })
})
