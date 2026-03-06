/**
 * components/organisms/UserMenu.tsx — Header user menu.
 *
 * Shows a sign-in button when unauthenticated, or an avatar with dropdown when signed in.
 * Uses AnimatePresence for smooth dropdown animation.
 */
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, Settings, Clock, BarChart3 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/use-auth'

export function UserMenu() {
  const { user, isLoading, signOut } = useAuth()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, handleClickOutside])

  async function handleSignOut() {
    setIsOpen(false)
    await signOut()
    router.refresh()
  }

  // Loading state: pulsing skeleton circle
  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
    )
  }

  // Not authenticated: sign-in button
  if (!user) {
    return (
      <button
        onClick={() => router.push('/login')}
        className="glass-pill px-3 py-1.5 text-xs text-white/80 hover:text-white transition-colors"
      >
        Sign In
      </button>
    )
  }

  // Authenticated: avatar + dropdown
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const email = user.email ?? ''
  const initial = email[0]?.toUpperCase() ?? '?'

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-8 h-8 rounded-full overflow-hidden border border-white/20 hover:border-white/40 transition-colors flex items-center justify-center bg-white/10"
        data-testid="user-menu-trigger"
        aria-label="User menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="Profile"
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <span className="text-xs font-medium text-white/80">{initial}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            data-testid="user-menu-dropdown"
            className="absolute right-0 mt-2 w-56 glass-sm p-2 z-50"
          >
            <p className="px-3 py-2 text-xs text-white/50 truncate">{email}</p>
            <div className="h-px bg-white/10 my-1" />
            <button
              onClick={() => { setIsOpen(false); router.push('/history') }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Clock size={14} />
              History
            </button>
            <button
              onClick={() => { setIsOpen(false); router.push('/dashboard') }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <BarChart3 size={14} />
              Dashboard
            </button>
            <button
              onClick={() => { setIsOpen(false); router.push('/settings') }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Settings size={14} />
              Settings
            </button>
            <div className="h-px bg-white/10 my-1" />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
