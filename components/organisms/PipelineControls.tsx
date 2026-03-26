'use client'

import { useState } from 'react'
import { Play, Loader2, Zap, RefreshCw, Workflow } from 'lucide-react'
import { usePipelineTrigger, usePipelineRuns } from '@/lib/hooks/use-pipeline'

type RunType = 'ingest' | 'process' | 'full'

const RUN_TYPE_CONFIG: Record<RunType, { label: string; description: string; icon: typeof Play }> = {
  ingest: { label: 'Ingest', description: 'Fetch RSS feeds', icon: RefreshCw },
  process: { label: 'Process', description: 'Embed → Cluster → Assemble', icon: Zap },
  full: { label: 'Full Pipeline', description: 'Ingest + Process', icon: Workflow },
}

export function PipelineControls() {
  const { trigger, isTriggering } = usePipelineTrigger()
  const { mutate } = usePipelineRuns()
  const [activeType, setActiveType] = useState<RunType | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  async function handleTrigger(type: RunType) {
    setActiveType(type)
    setResult(null)

    try {
      const response = await trigger({ type })
      setResult({
        success: response?.success ?? false,
        message: response?.success ? `${type} pipeline completed successfully` : 'Pipeline run failed',
      })
      await mutate()
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Pipeline trigger failed',
      })
    } finally {
      setActiveType(null)
    }
  }

  return (
    <div className="glass space-y-4">
      <h2
        className="text-lg font-bold text-white"
        style={{ fontFamily: 'DM Serif Display, Georgia, serif' }}
      >
        Pipeline Controls
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.entries(RUN_TYPE_CONFIG) as [RunType, typeof RUN_TYPE_CONFIG[RunType]][]).map(
          ([type, config]) => {
            const Icon = config.icon
            const isActive = activeType === type

            return (
              <button
                key={type}
                onClick={() => handleTrigger(type)}
                disabled={isTriggering}
                className="glass-sm flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActive ? (
                  <Loader2 size={18} className="text-blue-400 animate-spin" />
                ) : (
                  <Icon size={18} className="text-white/60" />
                )}
                <div>
                  <p className="text-sm font-medium text-white">{config.label}</p>
                  <p className="text-xs text-white/50">{config.description}</p>
                </div>
              </button>
            )
          }
        )}
      </div>

      {result && (
        <div
          className={`glass-sm px-4 py-3 text-sm ${
            result.success ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  )
}
