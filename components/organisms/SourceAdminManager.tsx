/**
 * components/organisms/SourceAdminManager.tsx — Main orchestrator for admin sources.
 *
 * Split-panel layout: AdminSourceList (left) with detail/create/import views (right).
 * Manages selection state and panel switching.
 */
'use client'

import { useState, useCallback } from 'react'
import { useSWRConfig } from 'swr'
import { RefreshCw } from 'lucide-react'
import type { DbSource } from '@/lib/supabase/types'
import { AdminSourceList } from '@/components/organisms/AdminSourceList'
import { AdminSourceDetail } from '@/components/organisms/AdminSourceDetail'
import { AdminSourceCreate } from '@/components/organisms/AdminSourceCreate'
import { AdminSourceImport } from '@/components/organisms/AdminSourceImport'
import { useSyncRatings } from '@/lib/hooks/use-admin-sources'
import { useOwners } from '@/lib/hooks/use-owners'

type RightPanel = 'detail' | 'create' | 'import'

export function SourceAdminManager() {
  const [selectedSource, setSelectedSource] = useState<DbSource | null>(null)
  const [rightPanel, setRightPanel] = useState<RightPanel>('detail')
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const { mutate } = useSWRConfig()
  const { syncRatings, isSyncing } = useSyncRatings()
  const { owners } = useOwners()

  const revalidateAll = useCallback(() => {
    mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/admin/sources'))
  }, [mutate])

  const handleSelect = useCallback((source: DbSource) => {
    setSelectedSource(source)
    setRightPanel('detail')
  }, [])

  const handleCreateNew = useCallback(() => {
    setSelectedSource(null)
    setRightPanel('create')
  }, [])

  const handleImport = useCallback(() => {
    setSelectedSource(null)
    setRightPanel('import')
  }, [])

  const handleCreated = useCallback((created: DbSource) => {
    setSelectedSource(created)
    setRightPanel('detail')
    revalidateAll()
  }, [revalidateAll])

  const handleImported = useCallback(() => {
    revalidateAll()
  }, [revalidateAll])

  const handleUpdated = useCallback((updated: DbSource) => {
    setSelectedSource(updated)
    revalidateAll()
  }, [revalidateAll])

  const handleCancelCreate = useCallback(() => {
    setRightPanel('detail')
  }, [])

  const handleCancelImport = useCallback(() => {
    setRightPanel('detail')
  }, [])

  const handleSyncRatings = useCallback(async () => {
    setSyncMessage(null)
    try {
      const result = await syncRatings({})
      const data = result.data
      const parts = [`Synced ${data.synced} sources`]
      if (data.overridden > 0) parts.push(`${data.overridden} overridden`)
      if (data.skipped > 0) parts.push(`${data.skipped} skipped`)
      if (data.unmatched > 0) parts.push(`${data.unmatched} unmatched`)
      setSyncMessage(parts.join(', '))
      revalidateAll()
      setSelectedSource(null)
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Sync failed')
    }
  }, [syncRatings, revalidateAll])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={handleSyncRatings}
          disabled={isSyncing}
          className="glass-pill flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/70 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Syncing...' : 'Sync Ratings'}
        </button>
        {syncMessage && (
          <span className="text-xs text-white/50">{syncMessage}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left panel */}
        <div className="lg:col-span-2">
          <AdminSourceList
            selectedId={selectedSource?.id ?? null}
            onSelect={handleSelect}
            onCreateNew={handleCreateNew}
            onImport={handleImport}
          />
        </div>

        {/* Right panel */}
        <div className="lg:col-span-3">
          {rightPanel === 'create' && (
            <AdminSourceCreate
              onCreated={handleCreated}
              onCancel={handleCancelCreate}
            />
          )}
          {rightPanel === 'import' && (
            <AdminSourceImport
              onImported={handleImported}
              onCancel={handleCancelImport}
            />
          )}
          {rightPanel === 'detail' && (
            <AdminSourceDetail
              source={selectedSource}
              onUpdated={handleUpdated}
              owners={owners}
            />
          )}
        </div>
      </div>
    </div>
  )
}
