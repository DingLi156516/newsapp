/**
 * components/atoms/BiasTag.tsx — Colored circle indicating a source's political bias.
 *
 * "Atoms" are the smallest, most reusable UI components — they have no
 * sub-components, only HTML elements. Think of them like individual Lego bricks.
 *
 * This component renders a small filled circle whose background color maps to
 * a BiasCategory (e.g., 'left' → blue, 'right' → red). The color is applied
 * via a CSS class looked up from BIAS_CSS_CLASS in lib/types.ts.
 *
 * Usage examples:
 *   <BiasTag bias="center" />                     — small dot only
 *   <BiasTag bias="lean-left" label size="xs" />  — tiny dot + text label
 */
import type { BiasCategory } from '@/lib/types'
import { BIAS_LABELS, BIAS_CSS_CLASS } from '@/lib/types'

/** Props (equivalent to function parameters in a backend function) */
interface Props {
  bias: BiasCategory    // Which political bias to display
  label?: boolean       // If true, also show the text label next to the dot
  size?: 'xs' | 'sm'   // 'xs' = 16px for compact rows; 'sm' = 20px default
}

export function BiasTag({ bias, label = false, size = 'sm' }: Props) {
  // Look up the CSS class and human-readable label for this bias value.
  // This avoids hard-coding color styles inline — all colors are centralized
  // in globals.css via the spectrum-* CSS class names.
  const cssClass = BIAS_CSS_CLASS[bias]
  const biasLabel = BIAS_LABELS[bias]

  return (
    <span
      className={`inline-flex items-center rounded-full border border-white/10 ${
        size === 'xs' ? 'h-4 w-4' : 'h-5 w-5'
      }`}
      style={{ flexShrink: 0 }}
      title={biasLabel}                      // Tooltip on hover
      aria-label={`Bias: ${biasLabel}`}      // Screen reader label
    >
      {/* The inner span gets the colored background via the CSS class */}
      <span
        className={`${cssClass} w-full h-full rounded-full`}
      />
      {/* Conditionally render the text label — `&&` short-circuit in JSX */}
      {label && (
        <span className="ml-1.5 text-xs text-white/80 whitespace-nowrap">
          {biasLabel}
        </span>
      )}
    </span>
  )
}
