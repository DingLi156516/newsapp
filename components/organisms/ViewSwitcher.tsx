'use client'

import { motion } from 'framer-motion'

export type AppView = 'feed' | 'sources'

interface Props {
  readonly view: AppView
  readonly onChange: (v: AppView) => void
}

export function ViewSwitcher({ view, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="App view"
      data-testid="view-switcher"
      className="glass-sm flex items-center gap-1 rounded-[20px] p-1"
    >
      {(['feed', 'sources'] as const).map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={view === v}
          data-testid={`view-tab-${v}`}
          onClick={() => onChange(v)}
          className="relative px-4 py-1.5 text-sm transition-colors z-10"
        >
          {view === v && (
            <motion.span
              layoutId="view-switcher-pill"
              className="absolute inset-0 rounded-[16px] bg-white/10"
            />
          )}
          <span
            className={
              view === v
                ? 'relative text-white font-medium'
                : 'relative text-white/50 hover:text-white/70 transition-colors'
            }
          >
            {v === 'feed' ? 'Feed' : 'Sources'}
          </span>
        </button>
      ))}
    </div>
  )
}
