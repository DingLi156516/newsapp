import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { BiasCategory, DatePreset, FactualityLevel, FeedTab, Region, Topic } from '@/lib/types'
import { ALL_BIASES } from '@/lib/types'

function buildParams(current: URLSearchParams, updates: Record<string, string | null>): string {
  const params = new URLSearchParams(current.toString())
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  const str = params.toString()
  return str ? `/?${str}` : '/'
}

export function useFilterParams() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const push = useCallback(
    (updates: Record<string, string | null>) => {
      router.push(buildParams(searchParams, updates))
    },
    [router, searchParams]
  )

  // --- Read values ---

  const feedTab = (searchParams.get('tab') ?? 'trending') as FeedTab
  const topic = (searchParams.get('topic') as Topic | null)
  const search = searchParams.get('q') ?? ''
  const region = (searchParams.get('region') as Region | null)

  const biasParam = searchParams.get('bias')
  const biasRange: BiasCategory[] = biasParam
    ? biasParam.split(',') as BiasCategory[]
    : ALL_BIASES

  const minFactuality = (searchParams.get('factuality') as FactualityLevel | null)

  const datePresetParam = searchParams.get('date')
  const datePreset: DatePreset = (datePresetParam as DatePreset) ?? 'all'

  // --- Setters ---

  const setFeedTab = useCallback(
    (tab: FeedTab) => push({ tab: tab === 'trending' ? null : tab }),
    [push]
  )

  const tag = searchParams.get('tag') ?? null
  const tagType = searchParams.get('tag_type') ?? null
  const owner = searchParams.get('owner') ?? null

  const setTopic = useCallback(
    (t: Topic | null) => push({ topic: t, tag: null, tag_type: null }),
    [push]
  )

  const setTag = useCallback(
    (slug: string | null, type?: string | null) =>
      push({ tag: slug, tag_type: type ?? null, topic: null }),
    [push]
  )

  const setSearch = useCallback(
    (q: string) => push({ q: q || null }),
    [push]
  )

  const setRegion = useCallback(
    (r: Region | null) => push({ region: r }),
    [push]
  )

  const setBiasRange = useCallback(
    (bias: BiasCategory[]) => {
      const isAll = bias.length === ALL_BIASES.length &&
        ALL_BIASES.every(b => bias.includes(b))
      push({ bias: isAll ? null : bias.join(',') })
    },
    [push]
  )

  const setMinFactuality = useCallback(
    (f: FactualityLevel | null) => push({ factuality: f }),
    [push]
  )

  const setDatePreset = useCallback(
    (d: DatePreset) => push({ date: d === 'all' ? null : d }),
    [push]
  )

  const setOwner = useCallback(
    (slug: string | null) => push({ owner: slug }),
    [push]
  )

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    for (const key of ['topic', 'region', 'q', 'bias', 'factuality', 'date', 'tag', 'tag_type', 'owner']) {
      params.delete(key)
    }
    const str = params.toString()
    router.push(str ? `/?${str}` : '/')
  }, [router, searchParams])

  return {
    feedTab,
    topic,
    tag,
    tagType,
    owner,
    search,
    region,
    biasRange,
    minFactuality,
    datePreset,
    setFeedTab,
    setTopic,
    setTag,
    setSearch,
    setRegion,
    setBiasRange,
    setMinFactuality,
    setDatePreset,
    setOwner,
    clearAll,
  }
}
