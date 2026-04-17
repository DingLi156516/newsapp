/**
 * scripts/seed-ownership-decide.ts — Pure action-decision helpers for the
 * ownership backfill. Extracted so it can be unit-tested without triggering
 * the top-level env/client side effects in scripts/seed-ownership.ts.
 */

export interface SourceRow {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly wikidata_qid: string | null
  readonly owner_id: string | null
  readonly owner?: {
    readonly id: string
    readonly name: string
    readonly slug: string
    readonly wikidata_qid: string | null
    readonly owner_source: string
  } | null
}

export interface ResolvedOwner {
  readonly qid: string
  readonly name: string
  readonly country: string | null
  readonly inception: string | null
  readonly instanceOf: readonly string[]
  readonly hops: number
}

export type BackfillAction = 'insert' | 'link' | 'skip' | 'mismatch' | 'confirmed'
export type Confidence = 'high' | 'medium' | 'low'

export interface CsvRow {
  readonly source_slug: string
  readonly source_wikidata_qid: string
  readonly resolved_owner_name: string
  readonly resolved_owner_qid: string
  readonly resolved_owner_type: string
  readonly country: string
  readonly action: BackfillAction
  readonly confidence: Confidence
  readonly notes: string
}

export interface ActionDecision {
  readonly action: BackfillAction
  readonly confidence: Confidence
  readonly notes: string
}

// Wikidata instance_of QID → OwnerType
const INSTANCE_TO_OWNER_TYPE: Record<string, string> = {
  Q891723: 'public_company', // public company
  Q4830453: 'private_company', // business
  Q17343363: 'private_company', // privately held company
  Q163740: 'nonprofit', // nonprofit organization
  Q4287745: 'nonprofit', // nonprofit corporation
  Q5: 'individual', // human
  Q157031: 'public_broadcaster', // public broadcaster
  Q483551: 'public_broadcaster', // public service broadcaster
  Q131589: 'cooperative', // cooperative
  Q157857: 'state_adjacent', // state-owned enterprise
  Q18199255: 'state_adjacent', // state media
  Q20530050: 'trust', // trust
}

export function pickOwnerType(instanceOf: readonly string[]): string {
  for (const qid of instanceOf) {
    if (INSTANCE_TO_OWNER_TYPE[qid]) {
      return INSTANCE_TO_OWNER_TYPE[qid]
    }
  }
  return 'private_company'
}

/**
 * Decide the CSV action for a source given its current owner link + the
 * Wikidata-resolved owner.
 *
 * Rules:
 *   - No existing owner → `insert` (migration author uses ON CONFLICT (slug)
 *     DO NOTHING to dedupe if the owner row already exists)
 *   - Existing owner with matching QID → `confirmed` (no UPDATE needed)
 *   - Existing owner with differing/null QID → `mismatch` unless
 *     `--allow-overwrite` is set, in which case action is `link` with
 *     confidence clamped to `low` so a reviewer notices
 *
 * This closes Codex adversarial-review finding #1 (backfill could silently
 * relink curated sources).
 */
export function decideAction(params: {
  readonly source: SourceRow
  readonly resolved: ResolvedOwner
  readonly allowOverwrite: boolean
  readonly baseConfidence: Confidence
}): ActionDecision {
  const { source, resolved, allowOverwrite, baseConfidence } = params

  if (!source.owner_id) {
    return {
      action: 'insert',
      confidence: baseConfidence,
      notes:
        resolved.hops > 0
          ? `Walked ${resolved.hops} P127 hops`
          : 'Direct owner from Wikidata',
    }
  }

  const currentOwnerQid = source.owner?.wikidata_qid ?? null
  const currentOwnerSource = source.owner?.owner_source ?? 'manual'
  const currentOwnerLabel = source.owner?.name ?? source.owner_id

  if (currentOwnerQid && currentOwnerQid === resolved.qid) {
    return {
      action: 'confirmed',
      confidence: baseConfidence,
      notes: `Already linked to ${currentOwnerLabel} — matches Wikidata`,
    }
  }

  if (!allowOverwrite) {
    return {
      action: 'mismatch',
      confidence: 'low',
      notes: `Already linked to ${currentOwnerLabel}${currentOwnerQid ? ` (${currentOwnerQid})` : ''} via ${currentOwnerSource}; Wikidata proposes ${resolved.qid}. Re-run with --allow-overwrite to relink.`,
    }
  }

  return {
    action: 'link',
    confidence: 'low',
    notes: `Overwriting existing ${currentOwnerSource} link ${currentOwnerLabel} → ${resolved.name} (--allow-overwrite set)`,
  }
}
