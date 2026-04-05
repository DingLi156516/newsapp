/**
 * components/organisms/AdminSourceList.tsx — Left panel of admin sources split-panel.
 *
 * Search bar, filter pills (bias, region, active), and a scrollable
 * paginated source list.
 */
'use client'

import { useState, useCallback } from 'react'
import { Search, Plus, Upload } from 'lucide-react'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useAdminSources } from '@/lib/hooks/use-admin-sources'
import { AdminSourceListItem } from '@/components/molecules/AdminSourceListItem'
import { Skeleton } from '@/components/atoms/Skeleton'
import type { DbSource } from '@/lib/supabase/types'

type ActiveFilter = 'all' | 'true' | 'false'

interface Props {
  readonly selectedId: string | null
  readonly onSelect: (source: DbSource) => void
  readonly onCreateNew: () => void
  readonly onImport: () => void
}

export function AdminSourceList({ selectedId, onSelect, onCreateNew, onImport }: Props) {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounce(search, 300)

  const { sources, total, isLoading } = useAdminSources({
    search: debouncedSearch || undefined,
    is_active: activeFilter,
    page,
    limit: 50,
  })

  const totalPages = Math.ceil(total / 50)

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  const handleActiveFilter = useCallback((filter: ActiveFilter) => {
    setActiveFilter(filter)
    setPage(1)
  }, [])

  return (
    <div className="glass overflow-hidden flex flex-col h-[700px]">
      {/* Header with actions */}
      <div className="p-3 border-b border-white/10 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search sources..."
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
        </div>

        {/* Filter pills + action buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {(['all', 'true', 'false'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => handleActiveFilter(filter)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                  activeFilter === filter
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'true' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onImport}
              className="glass-pill flex items-center gap-1 px-2.5 py-1.5 text-xs text-white/70 hover:text-white transition-colors"
              title="Import CSV"
            >
              <Upload size={12} />
              Import
            </button>
            <button
              onClick={onCreateNew}
              className="glass-pill flex items-center gap-1 px-2.5 py-1.5 text-xs text-white/70 hover:text-white transition-colors"
              title="Add source"
            >
              <Plus size={12} />
              Add
            </button>
          </div>
        </div>

        {/* Count */}
        <p className="text-[11px] text-white/40">{total} source{total !== 1 ? 's' : ''}</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide divide-y divide-white/5">
        {isLoading ? (
          <div className="p-3 space-y-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : sources.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-white/40 text-sm">
            No sources found
          </div>
        ) : (
          sources.map((source) => (
            <AdminSourceListItem
              key={source.id}
              source={source}
              isSelected={selectedId === source.id}
              onClick={onSelect}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 border-t border-white/10">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-xs text-white/60 hover:text-white disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-white/40">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="text-xs text-white/60 hover:text-white disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
