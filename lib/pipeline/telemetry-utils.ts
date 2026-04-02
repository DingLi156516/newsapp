/**
 * lib/pipeline/telemetry-utils.ts — Shared pipeline telemetry helpers.
 */

export function toPerMinute(total: number, durationMs: number): number {
  if (total <= 0 || durationMs <= 0) {
    return 0
  }

  return Number(((total / durationMs) * 60_000).toFixed(2))
}
