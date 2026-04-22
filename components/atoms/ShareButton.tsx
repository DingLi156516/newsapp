'use client'

import { useState, useCallback } from 'react'
import { Share2 } from 'lucide-react'
import { Toast } from '@/components/atoms/Toast'
import { useTelemetryConsent } from '@/lib/hooks/use-telemetry-consent'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Props {
  readonly url: string
  readonly title: string
  readonly size?: 'sm' | 'md'
  readonly storyId?: string
}

export function ShareButton({ url, title, size = 'sm', storyId }: Props) {
  const [showToast, setShowToast] = useState(false)
  const iconSize = size === 'sm' ? 14 : 18
  const consent = useTelemetryConsent()

  const handleShare = useCallback(async () => {
    const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url

    let shared = false
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url: fullUrl })
        shared = true
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    if (!shared) {
      try {
        await navigator.clipboard.writeText(fullUrl)
        setShowToast(true)
        // Clipboard fallback completing successfully counts as a share —
        // the user got a usable artifact (the URL on their clipboard).
        shared = true
      } catch {
        // Clipboard API not available
      }
    }

    // UUID guard: the route's Zod schema rejects non-UUID story ids,
    // so a sample-data fallback (`a1`, `a2`, …) or a stale shared URL
    // would otherwise produce 400s on every share. Mirrors the
    // identical check in useStoryTelemetry.
    if (shared && storyId && consent && UUID_REGEX.test(storyId)) {
      try {
        // Chain `.catch` here: a bare `void fetch(...)` would surface an
        // unhandled rejection on offline/blocked requests, which is
        // exactly the path PWA users hit.
        fetch('/api/events/story', {
          method: 'POST',
          credentials: 'same-origin',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyId,
            action: 'share',
            client: 'web',
          }),
        }).catch(() => {})
      } catch {
        // best-effort — never block on a telemetry failure
      }
    }
  }, [url, title, storyId, consent])

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleShare()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
          }
        }}
        className="text-white/40 hover:text-white/70 transition-colors"
        aria-label={`Share ${title}`}
        data-testid="share-button"
      >
        <Share2 size={iconSize} />
      </button>
      <Toast
        message="Link copied!"
        visible={showToast}
        onDismiss={() => setShowToast(false)}
      />
    </>
  )
}
