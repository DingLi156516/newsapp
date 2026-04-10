/**
 * components/organisms/AdminSourceCreate.tsx — Right panel: new source form with RSS discovery.
 *
 * Form for creating a new source with inline RSS auto-discovery.
 * Auto-generates slug from name unless manually overridden.
 */
'use client'

import { useState, useCallback } from 'react'
import { Plus, Search, Rss, X } from 'lucide-react'
import { useCreateSource, useDiscoverRss } from '@/lib/hooks/use-admin-sources'
import { normalizeSourceSlug } from '@/lib/source-slugs'
import { BIAS_LABELS, FACTUALITY_LABELS, OWNERSHIP_LABELS, REGION_LABELS } from '@/lib/types'
import type { BiasCategory, FactualityLevel, OwnershipType, Region } from '@/lib/types'
import type { DbSource, SourceType } from '@/lib/supabase/types'

interface Props {
  readonly onCreated: (created: DbSource) => void
  readonly onCancel: () => void
}

const BIASES: BiasCategory[] = ['far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right']
const FACTUALITIES: FactualityLevel[] = ['very-high', 'high', 'mixed', 'low', 'very-low']
const OWNERSHIPS: OwnershipType[] = ['independent', 'corporate', 'private-equity', 'state-funded', 'telecom', 'government', 'non-profit', 'other']
const REGIONS: Region[] = ['us', 'international', 'uk', 'canada', 'europe']
const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  rss: 'RSS Feed',
  crawler: 'Web Crawler',
  news_api: 'News API',
}

interface FormState {
  name: string
  slug: string
  slugManual: boolean
  url: string
  rss_url: string
  bias: BiasCategory
  factuality: FactualityLevel
  ownership: OwnershipType
  region: Region
  source_type: SourceType
  ingestion_config: string
}

const INITIAL_FORM: FormState = {
  name: '',
  slug: '',
  slugManual: false,
  url: '',
  rss_url: '',
  bias: 'center',
  factuality: 'high',
  ownership: 'corporate',
  region: 'us',
  source_type: 'rss',
  ingestion_config: '{}',
}

export function AdminSourceCreate({ onCreated, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [error, setError] = useState<string | null>(null)
  const { create, isCreating } = useCreateSource()
  const { discover, isDiscovering } = useDiscoverRss()
  const [discoveredFeeds, setDiscoveredFeeds] = useState<{ url: string; source: string; title?: string }[]>([])

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'name' && !prev.slugManual) {
        next.slug = normalizeSourceSlug(value as string)
      }
      return next
    })
  }, [])

  const handleSlugChange = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, slug: value, slugManual: true }))
  }, [])

  const handleDiscoverRss = useCallback(async () => {
    if (!form.url) return
    setError(null)
    try {
      const result = await discover({ url: form.url })
      setDiscoveredFeeds(result.data ?? [])
      if (result.data?.length === 0) {
        setError('No RSS feeds found at this URL')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed')
    }
  }, [form.url, discover])

  const handleSelectFeed = useCallback((feedUrl: string) => {
    setForm((prev) => ({ ...prev, rss_url: feedUrl }))
    setDiscoveredFeeds([])
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError('Name is required')
      return
    }

    let parsedConfig: Record<string, unknown> = {}
    if (form.source_type !== 'rss' && form.ingestion_config.trim()) {
      try {
        parsedConfig = JSON.parse(form.ingestion_config)
      } catch {
        setError('Ingestion config must be valid JSON')
        return
      }
    }

    try {
      const result = await create({
        name: form.name.trim(),
        slug: form.slug || undefined,
        url: form.url || undefined,
        rss_url: form.rss_url || undefined,
        bias: form.bias,
        factuality: form.factuality,
        ownership: form.ownership,
        region: form.region,
        source_type: form.source_type,
        ingestion_config: parsedConfig,
      })
      onCreated(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    }
  }, [form, create, onCreated])

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-base font-semibold text-white">Add New Source</h2>
        <button
          onClick={onCancel}
          className="glass-pill flex items-center gap-1 px-3 py-1.5 text-xs text-white/70 hover:text-white"
        >
          <X size={12} />
          Cancel
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <FormField label="Name *">
          <input
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., The Washington Post"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
            autoFocus
          />
        </FormField>

        <FormField label="Slug">
          <input
            value={form.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="auto-generated from name"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
        </FormField>

        <FormField label="Source Type">
          <select
            value={form.source_type}
            onChange={(e) => updateField('source_type', e.target.value as SourceType)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
          >
            {(Object.keys(SOURCE_TYPE_LABELS) as SourceType[]).map((t) => (
              <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Website URL">
          <div className="flex gap-2">
            <input
              value={form.url}
              onChange={(e) => updateField('url', e.target.value)}
              placeholder="https://example.com"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
            />
            <button
              type="button"
              onClick={handleDiscoverRss}
              disabled={!form.url || isDiscovering}
              className="glass-pill flex items-center gap-1 px-3 py-2 text-xs text-white/70 hover:text-white disabled:opacity-30 shrink-0"
              title="Discover RSS feeds"
            >
              <Search size={12} />
              {isDiscovering ? 'Searching...' : 'Find RSS'}
            </button>
          </div>
        </FormField>

        {discoveredFeeds.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
            <p className="text-xs text-white/50 uppercase tracking-wide">Discovered Feeds</p>
            {discoveredFeeds.map((feed) => (
              <button
                key={feed.url}
                type="button"
                onClick={() => handleSelectFeed(feed.url)}
                className="w-full text-left p-2 rounded bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <Rss size={12} className="text-orange-400 shrink-0" />
                <div className="min-w-0">
                  {feed.title && <p className="text-xs text-white/70">{feed.title}</p>}
                  <p className="text-[11px] text-white/40 truncate">{feed.url}</p>
                </div>
                <span className="text-[10px] text-white/30 shrink-0">{feed.source}</span>
              </button>
            ))}
          </div>
        )}

        <FormField label="RSS URL">
          <input
            value={form.rss_url}
            onChange={(e) => updateField('rss_url', e.target.value)}
            placeholder="https://example.com/feed"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
        </FormField>

        {form.source_type !== 'rss' && (
          <FormField label="Ingestion Config (JSON)">
            <textarea
              value={form.ingestion_config}
              onChange={(e) => updateField('ingestion_config', e.target.value)}
              placeholder={form.source_type === 'crawler'
                ? '{\n  "articleListUrl": "https://...",\n  "articleLinkSelector": "a.article"\n}'
                : '{\n  "provider": "newsapi",\n  "country": "us"\n}'
              }
              rows={5}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-white/20"
            />
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Bias *">
            <select
              value={form.bias}
              onChange={(e) => updateField('bias', e.target.value as BiasCategory)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
            >
              {BIASES.map((b) => (
                <option key={b} value={b}>{BIAS_LABELS[b]}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Factuality *">
            <select
              value={form.factuality}
              onChange={(e) => updateField('factuality', e.target.value as FactualityLevel)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
            >
              {FACTUALITIES.map((f) => (
                <option key={f} value={f}>{FACTUALITY_LABELS[f]}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Ownership *">
            <select
              value={form.ownership}
              onChange={(e) => updateField('ownership', e.target.value as OwnershipType)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
            >
              {OWNERSHIPS.map((o) => (
                <option key={o} value={o}>{OWNERSHIP_LABELS[o]}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Region">
            <select
              value={form.region}
              onChange={(e) => updateField('region', e.target.value as Region)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>{REGION_LABELS[r]}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isCreating || !form.name.trim()}
            className="w-full glass-pill flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
          >
            <Plus size={14} />
            {isCreating ? 'Creating...' : 'Create Source'}
          </button>
        </div>
      </form>
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
