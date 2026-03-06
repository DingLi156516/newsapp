/**
 * components/atoms/ReviewStatusBadge.tsx — Pill badge for review status.
 *
 * Color-coded: amber (pending), green (approved), red (rejected), blue (editing).
 */

type BadgeStatus = 'pending' | 'approved' | 'rejected' | 'editing'

interface Props {
  status: BadgeStatus
}

const STATUS_CONFIG: Record<BadgeStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  },
  approved: {
    label: 'Approved',
    className: 'text-green-400 border-green-400/30 bg-green-400/10',
  },
  rejected: {
    label: 'Rejected',
    className: 'text-red-400 border-red-400/30 bg-red-400/10',
  },
  editing: {
    label: 'Editing',
    className: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  },
}

export function ReviewStatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={`glass-pill inline-flex items-center px-2 py-0.5 text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  )
}
