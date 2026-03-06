'use client'

interface StatTile {
  readonly value: number
  readonly label: string
}

interface Props {
  readonly stories: number
  readonly sources: number
  readonly blindspots: number
  readonly saved: number
  readonly className?: string
}

export function StatsRow({ stories, sources, blindspots, saved, className = '' }: Props) {
  const tiles: StatTile[] = [
    { value: stories, label: 'Stories' },
    { value: sources, label: 'Sources' },
    { value: blindspots, label: 'Blindspots' },
    { value: saved, label: 'Saved' },
  ]

  return (
    <div data-testid="stats-row" className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${className}`}>
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 flex items-center gap-2"
        >
          <span className="text-lg font-semibold text-white">{tile.value}</span>
          <span className="text-[10px] uppercase tracking-wide text-white/40">
            {tile.label}
          </span>
        </div>
      ))}
    </div>
  )
}
