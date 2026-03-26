'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  readonly message: string
  readonly visible: boolean
  readonly onDismiss: () => void
  readonly duration?: number
}

export function Toast({ message, visible, onDismiss, duration = 2000 }: Props) {
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [visible, onDismiss, duration])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-pill px-4 py-2 text-sm text-white shadow-lg"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
