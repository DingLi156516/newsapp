/**
 * lib/ingestion/source-policy.ts — Source-health control plane policy.
 *
 * Single source of truth for the eligibility filter, cooldown ramp, and
 * auto-disable predicate. The SQL function `increment_source_failure` in
 * migration 046 mirrors these constants — bump one, bump the other.
 *
 * Closes Codex review finding #10 (MEDIUM).
 */

import type { DbSource } from '@/lib/supabase/types'

/** Hard cap on the cooldown ramp — 4 hours. */
const COOLDOWN_CAP_MINUTES = 240

/** After 8 consecutive failures the exponent stops growing. */
const COOLDOWN_EXPONENT_CAP = 8

/** Auto-disable triggers at this many consecutive failures. */
const AUTO_DISABLE_FAILURE_THRESHOLD = 10

/**
 * Auto-disable only fires when the source has < this many lifetime
 * successes. High-value sources with thousands of successes stay ON
 * during a transient outage burst — operators must intervene manually.
 */
const AUTO_DISABLE_LIFETIME_SUCCESS_FLOOR = 20

/**
 * Returns true when a source is eligible to be fetched right now.
 *
 * The eligibility predicate replaces the old `is_active = true` test
 * and becomes the single read-side gate enforced by the registry.
 */
export function isSourceEligible(
  source: DbSource,
  now: Date = new Date()
): boolean {
  if (!source.is_active) return false
  if (source.auto_disabled_at !== null) return false
  if (source.cooldown_until !== null && new Date(source.cooldown_until) > now) {
    return false
  }
  return true
}

/**
 * Cooldown ramp: 2^min(consecutive, 8) minutes, capped at 240.
 *
 * 1→2m, 2→4m, 3→8m, 4→16m, 5→32m, 6→64m, 7→128m, 8+→240m.
 *
 * The ramp is gentle at first so a flaky network blip does not lock a
 * source out for an hour, and capped at 4h so a permanently dead feed
 * cannot hammer the cron job every cycle.
 */
export function computeCooldownMs(consecutiveFailures: number): number {
  const exponent = Math.min(consecutiveFailures, COOLDOWN_EXPONENT_CAP)
  const minutes = Math.min(Math.pow(2, exponent), COOLDOWN_CAP_MINUTES)
  return minutes * 60 * 1000
}

/**
 * Returns true when the source should be auto-disabled.
 *
 * The predicate AND-joins consecutive failures with a low lifetime-success
 * bar so a high-value source with thousands of successes stays ON during
 * a transient outage. Surfaces a high `consecutive_failures` instead and
 * lets an operator decide based on the dashboard.
 */
export function shouldAutoDisable(
  consecutiveFailures: number,
  lifetimeSuccesses: number
): boolean {
  return (
    consecutiveFailures >= AUTO_DISABLE_FAILURE_THRESHOLD &&
    lifetimeSuccesses < AUTO_DISABLE_LIFETIME_SUCCESS_FLOOR
  )
}
