/**
 * components/atoms/BookmarkButton.tsx — Animated save/unsave button.
 *
 * Uses `framer-motion` for micro-animations:
 *   - `whileTap={{ scale: 0.8 }}` — briefly shrinks on press (tactile feedback)
 *   - `animate={{ opacity: ... }}` — fades icon in/out between saved states
 *
 * The `'use client'` directive marks this as a Client Component.
 * In Next.js App Router, any component that uses browser-only APIs, hooks,
 * or event handlers (onClick) must be a Client Component.
 *
 * The button calls `e.stopPropagation()` to prevent the click from bubbling up
 * to the NexusCard, which would navigate to the detail page instead of bookmarking.
 */
'use client'

import { motion } from 'framer-motion'
import { Bookmark } from 'lucide-react'

interface Props {
  isSaved: boolean          // Whether this article is currently bookmarked
  onToggle: () => void      // Callback to toggle bookmark state in the parent
  size?: 'sm' | 'md'       // 'sm' = 14px icon (used on cards); 'md' = 16px (detail page)
}

export function BookmarkButton({ isSaved, onToggle, size = 'md' }: Props) {
  const iconSize = size === 'sm' ? 14 : 16

  return (
    // motion.button is Framer Motion's animated version of a standard <button>.
    // whileTap applies a transform only while the button is being pressed.
    <motion.button
      onClick={(e) => {
        e.stopPropagation()  // Prevent click from reaching the parent card/article element
        onToggle()
      }}
      whileTap={{ scale: 0.8 }}
      data-testid="bookmark-button"
      className="flex items-center justify-center rounded-full p-2 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
      aria-label={isSaved ? 'Remove bookmark' : 'Bookmark story'}
      aria-pressed={isSaved}  // ARIA attribute: tells screen readers this is a toggle
    >
      {/* motion.div animates the opacity transition when isSaved changes */}
      <motion.div
        animate={{ opacity: isSaved ? 1 : 0.4 }}
        transition={{ duration: 0.2 }}
      >
        <Bookmark
          size={iconSize}
          strokeWidth={1.5}
          fill={isSaved ? 'white' : 'transparent'}  // Filled when saved, outline when not
          className="text-white"
        />
      </motion.div>
    </motion.button>
  )
}
