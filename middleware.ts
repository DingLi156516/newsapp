/**
 * middleware.ts — Session refresh + route protection middleware.
 *
 * Creates a cookie-aware Supabase client per request, calls getUser() to
 * validate/refresh the JWT server-side, and handles auth-related redirects.
 *
 * Also seeds an opaque, rotating telemetry session id (`axiom_session`)
 * used by the engagement-capture pipeline. The cookie is httpOnly, SameSite
 * Lax, 7-day expiry; rotated when older than 7 days. We use crypto.randomUUID
 * for generation — no per-user input flows in, so the cookie cannot be
 * reversed back to the user. Honors the `DNT: 1` request header by emitting
 * `x-axiom-dnt: 1` on the response so the client hook can short-circuit
 * without an extra round trip.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const SESSION_COOKIE_NAME = 'axiom_session'
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days, matches mobile rotation
export const DNT_RESPONSE_HEADER = 'x-axiom-dnt'

export interface SessionCookieDecision {
  readonly shouldSet: boolean
  readonly value: string
  readonly options: {
    readonly httpOnly: true
    readonly sameSite: 'lax'
    readonly secure: boolean
    readonly path: '/'
    readonly maxAge: number
  }
}

/**
 * Pure decision helper for the telemetry session cookie. Extracted so it
 * can be unit-tested without spinning up the full Next middleware stack.
 *
 * @param existingValue - current cookie value (or undefined)
 * @param newValueFactory - injectable UUID generator (for deterministic tests)
 */
export function decideSessionCookie(
  existingValue: string | undefined,
  newValueFactory: () => string = defaultUuid,
  isProduction: boolean = process.env.NODE_ENV === 'production'
): SessionCookieDecision {
  const hasValid = typeof existingValue === 'string' && existingValue.length > 0
  return {
    shouldSet: !hasValid,
    value: hasValid ? existingValue : newValueFactory(),
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE,
    },
  }
}

function defaultUuid(): string {
  // Edge runtime exposes globalThis.crypto.randomUUID; call through
  // `cryptoRef.randomUUID()` so the underlying implementation receives the
  // correct `this` binding (Node 18+ refuses a detached reference).
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

function ensureSessionCookie(
  request: NextRequest,
  response: NextResponse
): void {
  const decision = decideSessionCookie(request.cookies.get(SESSION_COOKIE_NAME)?.value)
  if (!decision.shouldSet) return
  response.cookies.set(SESSION_COOKIE_NAME, decision.value, decision.options)
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          supabaseResponse = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // Validate the JWT server-side (not just decode — getSession only decodes).
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect authenticated users away from login/signup pages.
  const { pathname } = request.nextUrl
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Redirect unauthenticated users from protected routes.
  const protectedPaths = ['/dashboard', '/settings', '/history', '/admin']
  if (!user && protectedPaths.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Seed telemetry session id + DNT advertisement on every response we
  // return from this middleware. Done at the end so the response object
  // is stable (Supabase auth path may have re-created it).
  // Respect DNT: don't mint a session cookie, AND actively expire any
  // existing one. A user who already had a session cookie and then
  // turned DNT on would otherwise keep shipping that identifier for up
  // to 7 days until the cookie naturally expires — which defeats the
  // privacy guarantee we advertise. The response header still carries
  // `x-axiom-dnt: 1` so the client hook can short-circuit too.
  const isDnt = request.headers.get('dnt') === '1'
  if (isDnt) {
    supabaseResponse.headers.set(DNT_RESPONSE_HEADER, '1')
    if (request.cookies.get(SESSION_COOKIE_NAME)?.value) {
      supabaseResponse.cookies.set(SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
      })
    }
  } else {
    ensureSessionCookie(request, supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
