'use client'

import { useState, useCallback } from 'react'
import { Share2 } from 'lucide-react'
import { Toast } from '@/components/atoms/Toast'

interface Props {
  readonly url: string
  readonly title: string
  readonly size?: 'sm' | 'md'
}

export function ShareButton({ url, title, size = 'sm' }: Props) {
  const [showToast, setShowToast] = useState(false)
  const iconSize = size === 'sm' ? 14 : 18

  const handleShare = useCallback(async () => {
    const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url: fullUrl })
        return
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(fullUrl)
      setShowToast(true)
    } catch {
      // Clipboard API not available
    }
  }, [url, title])

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
