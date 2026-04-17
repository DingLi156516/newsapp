/**
 * scripts/seed-ownership.ts — Backfill media_owners + sources.owner_id via Wikidata.
 *
 * Strategy:
 *   1. For every active source, look up its wikidata_qid. If missing, skip and
 *      emit a warning row so an operator can fill it in manually.
 *   2. SPARQL-resolve P127 (owned by) with up to 3 hops of parent-walking so we
 *      land on a leaf-media conglomerate (e.g. CNN → WarnerMedia → Warner Bros. Discovery).
 *   3. Resolve owner name, country, inception date, and owner_type heuristically
 *      from instance-of claims.
 *   4. Emit CSV with columns: source_slug, source_wikidata_qid, resolved_owner_name,
 *      resolved_owner_qid, resolved_owner_type, country, action, confidence, notes.
 *
 * Usage (safe-by-default dry-run):
 *   npx tsx scripts/seed-ownership.ts --dry-run --out scripts/out/ownership-backfill.csv
 *
 * Plan review: write migration 051_ownership_backfill.sql from the approved CSV
 * rows. Direct-apply mode is intentionally omitted — migrations only, no runtime
 * upserts from this script. (See CLAUDE.md "No MCP migrations" policy.)
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { SparqlClient, qidFromUri } from '@/lib/wikidata/sparql-client'
import {
  decideAction,
  pickOwnerType,
  type CsvRow,
  type ResolvedOwner,
  type SourceRow,
} from './seed-ownership-decide'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const allowOverwrite = args.includes('--allow-overwrite')
const outIdx = args.indexOf('--out')
const outPath =
  outIdx !== -1 ? args[outIdx + 1] : path.join('scripts', 'out', 'ownership-backfill.csv')
const maxHopsIdx = args.indexOf('--max-hops')
const maxHops = maxHopsIdx !== -1 ? parseInt(args[maxHopsIdx + 1], 10) || 3 : 3

if (!dryRun) {
  console.error('Refusing to run without --dry-run. This script is CSV-only by design.')
  console.error('Write supabase/migrations/051_ownership_backfill.sql from the approved CSV.')
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const sparql = new SparqlClient()

async function fetchSources(): Promise<SourceRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sources') as any)
    .select(
      'id, slug, name, wikidata_qid, owner_id, owner:media_owners(id, name, slug, wikidata_qid, owner_source)'
    )
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch sources: ${error.message}`)
  }
  return (data ?? []) as SourceRow[]
}

/**
 * Resolver output. When Wikidata returns multiple distinct P127 owners for
 * the same entity (current + former, competing claims, etc.) we surface the
 * full candidate list so the caller can emit an ambiguity row instead of
 * silently picking bindings[0]. The selected owner is only non-null when a
 * single candidate dominates (preferred rank, or lone result).
 */
interface ResolverResult {
  readonly selected: ResolvedOwner | null
  readonly candidates: readonly ResolvedOwner[]
}

async function resolveOwner(qid: string, hop: number): Promise<ResolverResult> {
  // SPARQL: pull owner-of (P127) with statement rank, inception (P571),
  // country (P17), and instance_of (P31). Request the rank so we can prefer
  // Wikidata's preferred statements and filter out deprecated ones.
  const query = `
    SELECT ?owner ?ownerLabel ?rank ?countryCode ?inception ?instanceOf WHERE {
      wd:${qid} p:P127 ?stmt .
      ?stmt ps:P127 ?owner .
      ?stmt wikibase:rank ?rank .
      FILTER(?rank != wikibase:DeprecatedRank) .
      OPTIONAL { ?owner wdt:P17/wdt:P298 ?countryCode . }
      OPTIONAL { ?owner wdt:P571 ?inception . }
      OPTIONAL { ?owner wdt:P31 ?instanceOf . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    LIMIT 40
  `
  const response = await sparql.query(query)
  const bindings = response.results.bindings
  if (bindings.length === 0) return { selected: null, candidates: [] }

  // Group bindings by owner QID so instance_of / country are attributed to
  // the right owner, not mixed across candidates.
  interface Group {
    qid: string
    name: string
    rank: 'preferred' | 'normal'
    country: string | null
    inception: string | null
    instanceOf: Set<string>
  }
  const groups = new Map<string, Group>()
  for (const b of bindings) {
    const ownerQid = qidFromUri(b.owner?.value)
    if (!ownerQid) continue
    const rank: Group['rank'] = b.rank?.value?.endsWith('PreferredRank') ? 'preferred' : 'normal'
    const existing = groups.get(ownerQid)
    if (existing) {
      if (b.countryCode?.value && !existing.country) existing.country = b.countryCode.value
      if (b.inception?.value && !existing.inception) existing.inception = b.inception.value
      const inst = qidFromUri(b.instanceOf?.value)
      if (inst) existing.instanceOf.add(inst)
      // Prefer a preferred-rank binding's rank over a normal one
      if (rank === 'preferred') existing.rank = 'preferred'
    } else {
      const inst = qidFromUri(b.instanceOf?.value)
      groups.set(ownerQid, {
        qid: ownerQid,
        name: b.ownerLabel?.value ?? ownerQid,
        rank,
        country: b.countryCode?.value ?? null,
        inception: b.inception?.value ?? null,
        instanceOf: new Set(inst ? [inst] : []),
      })
    }
  }

  const candidates: ResolvedOwner[] = [...groups.values()].map((g) => ({
    qid: g.qid,
    name: g.name,
    country: g.country,
    inception: g.inception,
    instanceOf: [...g.instanceOf],
    hops: hop,
  }))

  if (candidates.length === 0) return { selected: null, candidates: [] }
  if (candidates.length === 1) return { selected: candidates[0], candidates }

  // Multiple candidates — pick preferred-rank ones
  const preferred = [...groups.values()].filter((g) => g.rank === 'preferred')
  if (preferred.length === 1) {
    const p = preferred[0]
    return {
      selected: {
        qid: p.qid,
        name: p.name,
        country: p.country,
        inception: p.inception,
        instanceOf: [...p.instanceOf],
        hops: hop,
      },
      candidates,
    }
  }

  // Truly ambiguous — no selection, surface all candidates
  return { selected: null, candidates }
}

async function walkToConglomerate(startQid: string): Promise<ResolverResult> {
  let current = startQid
  let lastResult: ResolverResult = { selected: null, candidates: [] }
  for (let hop = 0; hop < maxHops; hop++) {
    const result = await resolveOwner(current, hop)
    if (!result.selected && result.candidates.length === 0) return lastResult
    lastResult = result
    // Stop immediately if ambiguous — caller will emit a mismatch row
    if (!result.selected) return result
    const type = pickOwnerType(result.selected.instanceOf)
    if (type === 'public_company' || type === 'public_broadcaster' || type === 'state_adjacent') {
      return result
    }
    current = result.selected.qid
  }
  return lastResult
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function writeCsv(rows: readonly CsvRow[], outFile: string) {
  const header = [
    'source_slug',
    'source_wikidata_qid',
    'resolved_owner_name',
    'resolved_owner_qid',
    'resolved_owner_type',
    'country',
    'action',
    'confidence',
    'notes',
  ]
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.source_slug,
        row.source_wikidata_qid,
        row.resolved_owner_name,
        row.resolved_owner_qid,
        row.resolved_owner_type,
        row.country,
        row.action,
        row.confidence,
        row.notes,
      ]
        .map(csvEscape)
        .join(',')
    )
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf-8')
}

async function main() {
  console.log(`seed-ownership — dry-run: ${dryRun}, max-hops: ${maxHops}, out: ${outPath}`)

  const sources = await fetchSources()
  console.log(`Loaded ${sources.length} active sources`)

  const rows: CsvRow[] = []

  for (const source of sources) {
    if (!source.wikidata_qid) {
      rows.push({
        source_slug: source.slug,
        source_wikidata_qid: '',
        resolved_owner_name: '',
        resolved_owner_qid: '',
        resolved_owner_type: '',
        country: '',
        action: 'skip',
        confidence: 'low',
        notes: `Source ${source.name} has no wikidata_qid — fill in manually`,
      })
      continue
    }

    try {
      const { selected, candidates } = await walkToConglomerate(source.wikidata_qid)
      if (!selected && candidates.length === 0) {
        rows.push({
          source_slug: source.slug,
          source_wikidata_qid: source.wikidata_qid,
          resolved_owner_name: '',
          resolved_owner_qid: '',
          resolved_owner_type: '',
          country: '',
          action: 'skip',
          confidence: 'low',
          notes: 'No P127 claim found on Wikidata',
        })
        continue
      }
      if (!selected) {
        // Ambiguous — surface candidates so an operator can pick manually
        const candidateSummary = candidates
          .map((c) => `${c.name} (${c.qid})`)
          .join(' | ')
        rows.push({
          source_slug: source.slug,
          source_wikidata_qid: source.wikidata_qid,
          resolved_owner_name: '',
          resolved_owner_qid: '',
          resolved_owner_type: '',
          country: '',
          action: 'mismatch',
          confidence: 'low',
          notes: `Ambiguous Wikidata P127 — ${candidates.length} distinct candidates: ${candidateSummary}. Pick one manually and author migration row by hand.`,
        })
        continue
      }

      const ownerType = pickOwnerType(selected.instanceOf)
      const baseConfidence: CsvRow['confidence'] =
        selected.hops === 0 ? 'high' : selected.hops === 1 ? 'medium' : 'low'

      const { action, confidence, notes } = decideAction({
        source,
        resolved: selected,
        allowOverwrite,
        baseConfidence,
      })

      rows.push({
        source_slug: source.slug,
        source_wikidata_qid: source.wikidata_qid,
        resolved_owner_name: selected.name,
        resolved_owner_qid: selected.qid,
        resolved_owner_type: ownerType,
        country: selected.country ?? '',
        action,
        confidence,
        notes,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      rows.push({
        source_slug: source.slug,
        source_wikidata_qid: source.wikidata_qid,
        resolved_owner_name: '',
        resolved_owner_qid: '',
        resolved_owner_type: '',
        country: '',
        action: 'skip',
        confidence: 'low',
        notes: `Wikidata lookup failed: ${message.slice(0, 120)}`,
      })
    }
  }

  writeCsv(rows, outPath)
  const counts = rows.reduce<Record<string, number>>(
    (acc, r) => ({ ...acc, [r.action]: (acc[r.action] ?? 0) + 1 }),
    {}
  )
  console.log(`Wrote ${rows.length} rows to ${outPath}:`, counts)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
