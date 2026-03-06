/**
 * components/molecules/ForYouCta.tsx — Call-to-action overlay for anonymous users.
 *
 * Shown on the "For You" tab when the user is not authenticated.
 * Offers Sign In (→ /login) and Maybe Later (→ switches to Trending tab).
 */
'use client'

import Link from 'next/link'

interface Props {
  readonly onDismiss: () => void
}

export function ForYouCta({ onDismiss }: Props) {
  return (
    <div className="glass py-12 px-6 text-center space-y-4" data-testid="for-you-cta">
      <h2 className="font-serif text-xl font-bold text-white">
        Personalize Your Feed
      </h2>
      <p className="text-sm text-white/60 max-w-md mx-auto">
        Sign in to get stories ranked by your interests, reading history, and
        bias blindspots. Your feed, your perspective.
      </p>
      <div className="flex items-center justify-center gap-3 pt-2">
        <Link
          href="/login"
          className="glass-pill px-5 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-colors"
        >
          Sign In
        </Link>
        <button
          onClick={onDismiss}
          className="glass-pill px-5 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
        >
          Maybe Later
        </button>
      </div>
    </div>
  )
}
