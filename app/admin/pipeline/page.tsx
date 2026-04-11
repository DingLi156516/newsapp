/**
 * app/admin/pipeline/page.tsx — Admin pipeline dashboard.
 *
 * Protected by useRequireAuth + useAdmin. Shows pipeline controls,
 * run history, and source health.
 */
'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Activity, Database } from 'lucide-react'
import { useRequireAuth } from '@/lib/hooks/use-require-auth'
import { useAdmin } from '@/lib/hooks/use-admin'
import { UserMenu } from '@/components/organisms/UserMenu'
import { PipelineControls } from '@/components/organisms/PipelineControls'
import { PipelineSummaryStats } from '@/components/organisms/PipelineSummaryStats'
import { PipelineRunHistory } from '@/components/organisms/PipelineRunHistory'
import { SourceHealthTable } from '@/components/organisms/SourceHealthTable'
import { PipelineEventsPanel } from '@/components/organisms/PipelineEventsPanel'
import { PipelineDlqPanel } from '@/components/organisms/PipelineDlqPanel'
import { PipelineMaintenancePanel } from '@/components/organisms/PipelineMaintenancePanel'
import { Skeleton } from '@/components/atoms/Skeleton'

export default function AdminPipelinePage() {
  const router = useRouter()
  useRequireAuth()
  const { isAdmin, isLoading } = useAdmin()

  if (isLoading) {
    return (
      <div className="min-h-screen mesh-gradient">
        <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-64 w-full rounded-[24px]" />
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen mesh-gradient">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
              Feed
            </button>
            <UserMenu />
          </div>
          <div className="glass flex flex-col items-center justify-center py-16 text-center space-y-3">
            <ShieldCheck size={32} className="text-red-400" />
            <p className="text-white/80 text-sm">
              Access denied. Admin privileges required.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen mesh-gradient">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
              Feed
            </button>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 border border-white/10">
                <Activity size={16} className="text-white/80" />
              </div>
              <h1
                className="text-xl font-bold text-white"
                style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
              >
                Pipeline Dashboard
              </h1>
            </div>
            <Link
              href="/admin/review"
              className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
            >
              <ShieldCheck size={14} />
              Review
            </Link>
            <Link
              href="/admin/sources"
              className="glass-pill flex items-center gap-1.5 px-3 py-2 text-sm text-white/80 hover:text-white transition-colors"
            >
              <Database size={14} />
              Sources
            </Link>
          </div>
          <UserMenu />
        </div>

        <PipelineControls />
        <PipelineSummaryStats />
        <PipelineRunHistory />
        <SourceHealthTable />
        <PipelineEventsPanel />
        <PipelineDlqPanel />
        <PipelineMaintenancePanel />
      </div>
    </div>
  )
}
