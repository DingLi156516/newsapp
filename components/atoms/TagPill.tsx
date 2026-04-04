/**
 * components/atoms/TagPill.tsx — Entity tag pill with type-colored accent dot.
 */

import type { TagType } from '@/lib/types'
import { TAG_TYPE_LABELS, TAG_TYPE_COLORS } from '@/lib/types'

interface Props {
  readonly label: string
  readonly type: TagType
}

export function TagPill({ label, type }: Props) {
  return (
    <span
      className="glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-white/70"
      title={TAG_TYPE_LABELS[type]}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: TAG_TYPE_COLORS[type] }}
      />
      {label}
    </span>
  )
}
