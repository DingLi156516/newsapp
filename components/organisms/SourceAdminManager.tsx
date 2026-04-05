/**
 * components/organisms/SourceAdminManager.tsx — Main orchestrator for admin sources.
 *
 * Split-panel layout: AdminSourceList (left) with detail/create/import views (right).
 * Manages selection state and panel switching.
 */
'use client'

import { useState, useCallback } from 'react'
import { useSWRConfig } from 'swr'
import type { DbSource } from '@/lib/supabase/types'
import { AdminSourceList } from '@/components/organisms/AdminSourceList'
import { AdminSourceDetail } from '@/components/organisms/AdminSourceDetail'
import { AdminSourceCreate } from '@/components/organisms/AdminSourceCreate'
import { AdminSourceImport } from '@/components/organisms/AdminSourceImport'

type RightPanel = 'detail' | 'create' | 'import'

export function SourceAdminManager() {
  const [selectedSource, setSelectedSource] = useState<DbSource | null>(null)
  const [rightPanel, setRightPanel] = useState<RightPanel>('detail')
  const { mutate } = useSWRConfig()

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

  return (
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
          />
        )}
      </div>
    </div>
  )
}
