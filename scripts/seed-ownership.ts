/**
 * scripts/seed-ownership.ts — Backfill media_owners + sources.owner_id via Wikidata.
 *
 * Strategy:
 *   1. For every active source, look up its wikidata_qid. If missing, skip and
 *      emit a warning row so an operator can fill it in manually.
 *   2. SPARQL-resolve ownership via a UNION over P127 ("owned by"), P749
 *      ("parent organization"), and P123 ("publisher") with up to 3 hops of
 *      parent-walking so we land on a leaf-media conglomerate (e.g. CNN →
 *      WarnerMedia → Warner Bros. Discovery). Most news outlets express
 *      corporate ownership via P749 rather than P127, so the UNION materially
 *      improves coverage over the earlier P127-only query.
 *   3. Resolve owner name, country, inception date, and owner_type heuristically
 *      from instance-of claims. Track which property matched so confidence can
 *      be downgraded for weaker signals (P749/P123 ⇒ one tier below P127).
 *   4. Emit CSV with columns: source_slug, source_wikidata_qid, resolved_owner_name,
 *      resolved_owner_qid, resolved_owner_type, country, action, confidence, notes.
 *
 * Usage (safe-by-default dry-run):
 *   npx tsx scripts/seed-ownership.ts --dry-run --out scripts/out/ownership-backfill.csv
 *
 * Plan review: write the next available supabase/migrations/NNN_ownership_*.sql
 * from the approved CSV rows. Direct-apply mode is intentionally omitted —
 * migrations only, no runtime upserts from this script. (See CLAUDE.md "No MCP
 * migrations" policy.)
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { SparqlClient, qidFromUri } from '@/lib/wikidata/sparql-client'
import {
  bestStatement,
  compareStatements,
  decideAction,
  deriveConfidence,
  pickOwnerType,
  type CsvRow,
  type OwnershipProperty,
  type ResolvedOwner,
  type SourceRow,
  type Statement,
} from './seed-ownership-decide'

const PROPERTY_LABEL: Record<OwnershipProperty, string> = {
  P127: 'owned by',
  P749: 'parent organization',
  P123: 'publisher',
}

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
// `--max-hops` used to drive corporate-chain walking in walkToConglomerate
// before the resolver was constrained to a single hop. Parse-and-ignore so
// existing operator invocations don't error out; emit a heads-up in the
// startup log if it's passed so nobody wastes time tuning it.
const maxHopsIdx = args.indexOf('--max-hops')
const maxHopsDeprecated = maxHopsIdx !== -1

if (!dryRun) {
  console.error('Refusing to run without --dry-run. This script is CSV-only by design.')
  console.error('Write the next available supabase/migrations/NNN_ownership_*.sql from the approved CSV.')
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

interface Group {
  qid: string
  name: string
  country: string | null
  inception: string | null
  instanceOf: Set<string>
  statements: Statement[]
}

interface GroupWithBest {
  readonly group: Group
  readonly best: Statement
}

async function resolveOwner(qid: string, hop: number): Promise<ResolverResult> {
  // SPARQL: pull ownership claims via P127 (owned by), P749 (parent
  // organization), and P123 (publisher) with statement rank. Metadata
  // (country, inception, instance_of) is collapsed via GROUP_CONCAT so a
  // single (owner, property, rank) tuple produces one row regardless of
  // how many instance-of values exist. Deterministic ORDER BY + a LIMIT
  // large enough that truncation is effectively impossible.
  const query = `
    SELECT ?owner ?ownerLabel ?property ?rank
           (SAMPLE(?countryCode) AS ?country)
           (SAMPLE(?inception) AS ?inceptionAt)
           (GROUP_CONCAT(DISTINCT ?instanceOf; separator="|") AS ?instanceOfs)
    WHERE {
      {
        wd:${qid} p:P127 ?stmt .
        ?stmt ps:P127 ?owner .
        BIND("P127" AS ?property)
        ?stmt wikibase:rank ?rank .
      }
      UNION
      {
        wd:${qid} p:P749 ?stmt .
        ?stmt ps:P749 ?owner .
        BIND("P749" AS ?property)
        ?stmt wikibase:rank ?rank .
      }
      UNION
      {
        wd:${qid} p:P123 ?stmt .
        ?stmt ps:P123 ?owner .
        BIND("P123" AS ?property)
        ?stmt wikibase:rank ?rank .
      }
      FILTER(?rank != wikibase:DeprecatedRank) .
      OPTIONAL { ?owner wdt:P17/wdt:P298 ?countryCode . }
      OPTIONAL { ?owner wdt:P571 ?inception . }
      OPTIONAL { ?owner wdt:P31 ?instanceOf . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    }
    GROUP BY ?owner ?ownerLabel ?property ?rank
    ORDER BY ?owner ?property ?rank
    LIMIT 500
  `
  const response = await sparql.query(query)
  const bindings = response.results.bindings
  if (bindings.length === 0) return { selected: null, candidates: [] }

  // Group by owner QID, preserving per-statement (property, rank) tuples.
  // country/inception/instanceOf are attributes of the owner entity, not
  // the statement, so merging them across statements is safe.
  const groups = new Map<string, Group>()
  for (const b of bindings) {
    const ownerQid = qidFromUri(b.owner?.value)
    if (!ownerQid) continue
    const rawProperty = b.property?.value
    if (rawProperty !== 'P127' && rawProperty !== 'P749' && rawProperty !== 'P123') continue
    const property = rawProperty as OwnershipProperty
    const rank: Statement['rank'] = b.rank?.value?.endsWith('PreferredRank') ? 'preferred' : 'normal'
    const statement: Statement = { property, rank }

    const instanceOfs = b.instanceOfs?.value
      ? b.instanceOfs.value.split('|').map(qidFromUri).filter((q): q is string => !!q)
      : []

    const existing = groups.get(ownerQid)
    if (existing) {
      if (b.country?.value && !existing.country) existing.country = b.country.value
      if (b.inceptionAt?.value && !existing.inception) existing.inception = b.inceptionAt.value
      for (const inst of instanceOfs) existing.instanceOf.add(inst)
      existing.statements.push(statement)
    } else {
      groups.set(ownerQid, {
        qid: ownerQid,
        name: b.ownerLabel?.value ?? ownerQid,
        country: b.country?.value ?? null,
        inception: b.inceptionAt?.value ?? null,
        instanceOf: new Set(instanceOfs),
        statements: [statement],
      })
    }
  }

  const toResolved = (g: Group, best: Statement): ResolvedOwner => ({
    qid: g.qid,
    name: g.name,
    country: g.country,
    inception: g.inception,
    instanceOf: [...g.instanceOf],
    hops: hop,
    property: best.property,
  })

  const groupsList = [...groups.values()]
  const withBest: GroupWithBest[] = groupsList.map((g) => ({
    group: g,
    best: bestStatement(g.statements),
  }))
  const candidates: ResolvedOwner[] = withBest.map(({ group, best }) =>
    toResolved(group, best)
  )

  if (candidates.length === 0) return { selected: null, candidates: [] }
  if (candidates.length === 1) return { selected: candidates[0], candidates }

  // When best-properties span multiple tiers across candidates, auto-pick
  // is unsafe: rank-first selection can silently demote from a direct
  // `P127` owner to a parent-org `P749` owner or vice versa. Surface as
  // `mismatch` so the operator picks manually.
  const distinctProperties = new Set(withBest.map((b) => b.best.property))
  if (distinctProperties.size > 1) {
    return { selected: null, candidates }
  }

  // Same property tier across all candidates — pick the strongest rank.
  // Ties still emit mismatch.
  const topBest = [...withBest].sort((a, b) => compareStatements(a.best, b.best))[0]
    .best
  const winners = withBest.filter((b) => compareStatements(b.best, topBest) === 0)

  if (winners.length === 1) {
    return { selected: toResolved(winners[0].group, winners[0].best), candidates }
  }

  return { selected: null, candidates }
}

/**
 * Resolve the immediate owner of a source without walking further up any
 * corporate chain.
 *
 * Earlier versions recursed until they hit a `public_company`, `public_
 * broadcaster`, or `state_adjacent` node, the theory being that the script
 * should always land on a leaf conglomerate (e.g. CNN → WarnerMedia →
 * Warner Bros. Discovery). With the broadened P749/P123 coverage added
 * in this branch, that recursion becomes a hazard: a source owned by a
 * nonprofit, trust, or cooperative publisher would be walked *past* that
 * publisher toward some upstream funder, producing wrong CSV rows.
 *
 * Corporate subsidiary chains (WarnerMedia → Warner Bros. Discovery) are
 * already modeled at the data layer via `media_owners.parent_owner_id`,
 * so we do not need — and should not — synthesize the chain in the
 * resolver.
 */
async function walkToConglomerate(startQid: string): Promise<ResolverResult> {
  return resolveOwner(startQid, 0)
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
  console.log(`seed-ownership — dry-run: ${dryRun}, out: ${outPath}`)
  if (maxHopsDeprecated) {
    console.log('  (--max-hops is deprecated: resolver no longer walks corporate chains; value ignored)')
  }

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
          notes: 'No P127/P749/P123 claim found on Wikidata',
        })
        continue
      }
      if (!selected) {
        // Ambiguous — surface candidates so an operator can pick manually
        const candidateSummary = candidates
          .map((c) => `${c.name} (${c.qid}, ${c.property})`)
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
          notes: `Ambiguous Wikidata ownership — ${candidates.length} distinct candidates: ${candidateSummary}. Pick one manually and author migration row by hand.`,
        })
        continue
      }

      const ownerType = pickOwnerType(selected.instanceOf)
      const baseConfidence = deriveConfidence(selected.hops, selected.property)

      const { action, confidence, notes: decisionNotes } = decideAction({
        source,
        resolved: selected,
        allowOverwrite,
        baseConfidence,
      })

      const propertyNote = `Resolved via ${selected.property} (${PROPERTY_LABEL[selected.property]})`
      const notes = decisionNotes
        ? `${decisionNotes}; ${propertyNote}`
        : propertyNote

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
