/**
 * components/molecules/BiasLegend.tsx — Floating popover showing the bias color key.
 *
 * "Molecules" are components composed of multiple atoms. This component is a
 * dropdown popup that explains what each spectrum color represents.
 * It combines X icon (close button), a list of BiasTag-like swatches, and
 * click-outside behavior — making it a step more complex than a simple atom.
 *
 * It's rendered as a child of MonochromeSpectrumBar when the user clicks the
 * info (ℹ) button on the detail page.
 *
 * Key patterns used here:
 *   - `useRef`     — Gets a direct reference to the DOM node to detect outside clicks.
 *   - `useEffect`  — Attaches/detaches a global event listener for "click outside" logic.
 *                   The function returned from useEffect is the cleanup — React calls it
 *                   when the component unmounts, preventing memory/event listener leaks.
 */
'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { BIAS_LABELS, BIAS_CSS_CLASS } from '@/lib/types'
import type { BiasCategory } from '@/lib/types'

/**
 * Ordered left-to-right spectrum for rendering in the legend.
 * Defined outside the component so it's not re-created on each render.
 */
const BIAS_ORDER: BiasCategory[] = [
  'far-left',
  'left',
  'lean-left',
  'center',
  'lean-right',
  'right',
  'far-right',
]

interface Props {
  onClose: () => void  // Callback to close the legend (hides it from MonochromeSpectrumBar)
}

export function BiasLegend({ onClose }: Props) {
  // useRef gives us a stable reference to the legend's DOM element.
  // This reference persists across renders without triggering a re-render itself.
  const ref = useRef<HTMLDivElement>(null)

  /**
   * Click-outside-to-close behavior.
   *
   * useEffect runs after the component mounts (is added to the DOM).
   * It adds a mousedown listener to the entire document. When any mousedown
   * occurs, it checks if the click target is inside the legend div using
   * `ref.current.contains(e.target)`. If not, it fires onClose.
   *
   * The dependency array [onClose] tells React to only re-attach the listener
   * if the onClose function reference changes (rare in practice).
   *
   * The returned arrow function is the "cleanup" — React calls it before the
   * effect re-runs or when the component unmounts, removing the listener.
   */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={ref}
      // `absolute bottom-full right-0` positions the popup above and right-aligned
      // relative to the nearest CSS `position: relative` ancestor.
      className="glass-sm absolute bottom-full right-0 mb-2 z-50 p-3 min-w-[180px]"
      role="dialog"
      aria-label="Bias pattern legend"
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-medium text-white/80">Bias Key</span>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white/90 transition-colors"
          aria-label="Close legend"
        >
          <X size={12} />
        </button>
      </div>
      {/* Render one row per bias tier, left to right */}
      <ul className="space-y-1.5">
        {BIAS_ORDER.map((bias) => (
          <li key={bias} className="flex items-center gap-2">
            {/* Color swatch using the same CSS class as the spectrum bar segments */}
            <span
              className={`${BIAS_CSS_CLASS[bias]} flex-shrink-0 rounded`}
              style={{ width: 20, height: 12 }}
              aria-hidden="true"  // Hidden from screen readers — the text label already conveys this
            />
            <span className="text-xs text-white/80">{BIAS_LABELS[bias]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
