/**
 * components/organisms/AdminSourceDetail.tsx — Right panel: view/edit source with health metrics.
 *
 * Shows source metadata in a read/edit toggle form. Displays fetch health,
 * article count, and consecutive failures.
 */
'use client'

import { useState, useCallback, useEffect } from 'react'
import { Save, X, ExternalLink, Rss, RefreshCw, AlertTriangle } from 'lucide-react'
import { useUpdateSource } from '@/lib/hooks/use-admin-sources'
import { BIAS_LABELS, FACTUALITY_LABELS, OWNERSHIP_LABELS, REGION_LABELS } from '@/lib/types'
import type { BiasCategory, FactualityLevel, OwnershipType, Region } from '@/lib/types'
import type { DbSource } from '@/lib/supabase/types'

interface Props {
  readonly source: DbSource | null
  readonly onUpdated: (updated: DbSource) => void
}

const BIASES: BiasCategory[] = ['far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right']
const FACTUALITIES: FactualityLevel[] = ['very-high', 'high', 'mixed', 'low', 'very-low']
const OWNERSHIPS: OwnershipType[] = ['independent', 'corporate', 'private-equity', 'state-funded', 'telecom', 'government', 'non-profit', 'other']
const REGIONS: Region[] = ['us', 'international', 'uk', 'canada', 'europe']

interface FormState {
  name: string
  slug: string
  url: string
  rss_url: string
  bias: BiasCategory
  factuality: FactualityLevel
  ownership: OwnershipType
  region: Region
  is_active: boolean
  bias_override: boolean
}

function sourceToForm(source: DbSource): FormState {
  return {
    name: source.name,
    slug: source.slug,
    url: source.url ?? '',
    rss_url: source.rss_url ?? '',
    bias: source.bias,
    factuality: source.factuality,
    ownership: source.ownership,
    region: source.region,
    is_active: source.is_active,
    bias_override: source.bias_override,
  }
}

export function AdminSourceDetail({ source, onUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { update, isUpdating } = useUpdateSource()

  useEffect(() => {
    setIsEditing(false)
    setError(null)
    if (source) {
      setForm(sourceToForm(source))
    }
  }, [source])

  const handleEdit = useCallback(() => {
    if (source) {
      setForm(sourceToForm(source))
      setIsEditing(true)
      setError(null)
    }
  }, [source])

  const handleCancel = useCallback(() => {
    if (source) {
      setForm(sourceToForm(source))
      setIsEditing(false)
      setError(null)
    }
  }, [source])

  const handleSave = useCallback(async () => {
    if (!source || !form) return

    setError(null)

    const changes: Record<string, unknown> = {}
    if (form.name !== source.name) changes.name = form.name
    if (form.slug !== source.slug) changes.slug = form.slug
    if (form.url !== (source.url ?? '')) changes.url = form.url || null
    if (form.rss_url !== (source.rss_url ?? '')) changes.rss_url = form.rss_url || null
    if (form.bias !== source.bias) changes.bias = form.bias
    if (form.factuality !== source.factuality) changes.factuality = form.factuality
    if (form.ownership !== source.ownership) changes.ownership = form.ownership
    if (form.region !== source.region) changes.region = form.region
    if (form.is_active !== source.is_active) changes.is_active = form.is_active
    if (form.bias_override !== source.bias_override) changes.bias_override = form.bias_override

    if ((changes.bias !== undefined || changes.factuality !== undefined) && changes.bias_override === undefined) {
      changes.bias_override = form.bias_override
    }

    if (Object.keys(changes).length === 0) {
      setIsEditing(false)
      return
    }

    try {
      const result = await update({ id: source.id, data: changes })
      setIsEditing(false)
      onUpdated(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }, [source, form, update, onUpdated])

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : null))
  }, [])

  if (!source) {
    return (
      <div className="glass flex items-center justify-center py-24 text-white/40 text-sm">
        Select a source to view details
      </div>
    )
  }

  return (
    <div className="glass overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base font-semibold text-white truncate">{source.name}</h2>
          {!source.is_active && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 shrink-0">
              Inactive
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="glass-pill flex items-center gap-1 px-3 py-1.5 text-xs text-white/70 hover:text-white"
              >
                <X size={12} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isUpdating}
                className="glass-pill flex items-center gap-1 px-3 py-1.5 text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50"
              >
                <Save size={12} />
                {isUpdating ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              onClick={handleEdit}
              className="glass-pill px-3 py-1.5 text-xs text-white/70 hover:text-white"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Health metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-lg font-semibold text-white tabular-nums">{source.total_articles_ingested}</p>
            <p className="text-[11px] text-white/40">Articles</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className={`text-lg font-semibold tabular-nums ${
              source.consecutive_failures > 0 ? 'text-amber-400' : 'text-green-400'
            }`}>
              {source.consecutive_failures}
            </p>
            <p className="text-[11px] text-white/40">Failures</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className={`text-lg font-semibold ${
              source.last_fetch_status === 'success' ? 'text-green-400' : 'text-amber-400'
            }`}>
              {source.last_fetch_status === 'success' ? 'OK' : source.last_fetch_status}
            </p>
            <p className="text-[11px] text-white/40">Last Fetch</p>
          </div>
        </div>

        {source.last_fetch_error && (
          <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
            <p className="text-xs text-red-400/80 font-mono">{source.last_fetch_error}</p>
          </div>
        )}

        {/* Provider Bias Ratings */}
        <div className="bg-white/5 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wide">Bias Ratings</h3>
            {source.bias_sources_synced_at && (
              <span className="text-[10px] text-white/30 flex items-center gap-1">
                <RefreshCw size={10} />
                Synced {new Date(source.bias_sources_synced_at).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <ProviderCell label="MBFC" bias={source.bias_mbfc} factuality={source.factuality_mbfc} />
            <ProviderCell label="AllSides" bias={source.bias_allsides} factuality={source.factuality_allsides} />
            <ProviderCell label="Ad Fontes" bias={source.bias_adfm} factuality={null} />
          </div>

          {!(isEditing ? form?.bias_override : source.bias_override) && source.bias_sources_synced_at !== null
            && source.bias_mbfc === null && source.bias_allsides === null && source.bias_adfm === null && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                No bias providers currently match this source. Effective ratings may be outdated
                from a previous sync. Consider verifying or setting a manual override.
              </p>
            </div>
          )}

          {isEditing && (
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={form?.bias_override ?? source.bias_override}
                onChange={(e) => {
                  setForm((prev) => (prev ? { ...prev, bias_override: e.target.checked } : null))
                }}
                className="rounded border-white/20 bg-white/5"
              />
              <span className="text-xs text-white/60">
                Manual override — sync will not update effective bias/factuality
              </span>
            </label>
          )}
          {!isEditing && source.bias_override && (
            <p className="text-[10px] text-amber-400/70">Manual override active — sync skips effective ratings</p>
          )}
        </div>

        {/* Form fields */}
        <div className="space-y-3">
          <FormField label="Name">
            {isEditing ? (
              <input
                value={form?.name ?? ''}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
              />
            ) : (
              <p className="text-sm text-white/80">{source.name}</p>
            )}
          </FormField>

          <FormField label="Slug">
            {isEditing ? (
              <input
                value={form?.slug ?? ''}
                onChange={(e) => updateField('slug', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white/20"
              />
            ) : (
              <p className="text-sm text-white/80 font-mono">{source.slug}</p>
            )}
          </FormField>

          <FormField label="Website URL">
            {isEditing ? (
              <input
                value={form?.url ?? ''}
                onChange={(e) => updateField('url', e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
              />
            ) : source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {source.url}
                <ExternalLink size={12} />
              </a>
            ) : (
              <p className="text-sm text-white/30">Not set</p>
            )}
          </FormField>

          <FormField label="RSS URL">
            {isEditing ? (
              <input
                value={form?.rss_url ?? ''}
                onChange={(e) => updateField('rss_url', e.target.value)}
                placeholder="https://example.com/feed"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
              />
            ) : source.rss_url ? (
              <span className="text-sm text-white/80 flex items-center gap-1">
                <Rss size={12} className="text-orange-400" />
                {source.rss_url}
              </span>
            ) : (
              <p className="text-sm text-white/30">Not set</p>
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Bias">
              {isEditing ? (
                <select
                  value={form?.bias}
                  onChange={(e) => updateField('bias', e.target.value as BiasCategory)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
                >
                  {BIASES.map((b) => (
                    <option key={b} value={b}>{BIAS_LABELS[b]}</option>
                  ))}
                </select>
              ) : (
                <span className={`spectrum-${source.bias} glass-pill px-2 py-0.5 text-xs inline-block`}>
                  {BIAS_LABELS[source.bias]}
                </span>
              )}
            </FormField>

            <FormField label="Factuality">
              {isEditing ? (
                <select
                  value={form?.factuality}
                  onChange={(e) => updateField('factuality', e.target.value as FactualityLevel)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
                >
                  {FACTUALITIES.map((f) => (
                    <option key={f} value={f}>{FACTUALITY_LABELS[f]}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-white/80">{FACTUALITY_LABELS[source.factuality]}</p>
              )}
            </FormField>

            <FormField label="Ownership">
              {isEditing ? (
                <select
                  value={form?.ownership}
                  onChange={(e) => updateField('ownership', e.target.value as OwnershipType)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
                >
                  {OWNERSHIPS.map((o) => (
                    <option key={o} value={o}>{OWNERSHIP_LABELS[o]}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-white/80">{OWNERSHIP_LABELS[source.ownership]}</p>
              )}
            </FormField>

            <FormField label="Region">
              {isEditing ? (
                <select
                  value={form?.region}
                  onChange={(e) => updateField('region', e.target.value as Region)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{REGION_LABELS[r]}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-white/80">{REGION_LABELS[source.region]}</p>
              )}
            </FormField>
          </div>

          {isEditing && (
            <FormField label="Active">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form?.is_active ?? true}
                  onChange={(e) => updateField('is_active', e.target.checked)}
                  className="rounded border-white/20 bg-white/5"
                />
                <span className="text-sm text-white/70">
                  {form?.is_active ? 'Active — included in pipeline' : 'Inactive — excluded from pipeline'}
                </span>
              </label>
            </FormField>
          )}
        </div>

        {/* Timestamps */}
        <div className="border-t border-white/5 pt-3 flex items-center gap-4 text-[11px] text-white/30">
          <span>Created: {new Date(source.created_at).toLocaleDateString()}</span>
          <span>Updated: {new Date(source.updated_at).toLocaleDateString()}</span>
          {source.last_fetch_at && (
            <span>Last fetch: {new Date(source.last_fetch_at).toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-white/40 uppercase tracking-wide mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}

function ProviderCell({
  label,
  bias,
  factuality,
}: {
  label: string
  bias: BiasCategory | null
  factuality: FactualityLevel | null
}) {
  return (
    <div className="bg-white/5 rounded-lg p-2 text-center space-y-1">
      <p className="text-[10px] text-white/40 font-medium">{label}</p>
      {bias ? (
        <span className={`spectrum-${bias} glass-pill px-1.5 py-0.5 text-[10px] inline-block`}>
          {BIAS_LABELS[bias]}
        </span>
      ) : (
        <p className="text-[10px] text-white/20">No data</p>
      )}
      {factuality && (
        <p className="text-[10px] text-white/50">{FACTUALITY_LABELS[factuality]}</p>
      )}
    </div>
  )
}
