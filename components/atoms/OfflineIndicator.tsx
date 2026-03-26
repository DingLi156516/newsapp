/**
 * components/atoms/OfflineIndicator.tsx — Offline status banner.
 *
 * Shows a subtle glass-pill banner when the browser is offline,
 * letting the user know they're viewing cached content.
 */
'use client'

import { WifiOff } from 'lucide-react'
import { useOnline } from '@/lib/hooks/use-online'

export function OfflineIndicator() {
  const { isOnline } = useOnline()

  if (isOnline) return null

  return (
    <div
      data-testid="offline-indicator"
      className="glass-pill px-3 py-1.5 text-xs text-amber-400/80 flex items-center gap-1.5"
    >
      <WifiOff size={12} />
      <span>Viewing cached bookmarks</span>
    </div>
  )
}
