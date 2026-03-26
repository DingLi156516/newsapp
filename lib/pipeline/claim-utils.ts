const MINUTE_MS = 60 * 1000

export const ARTICLE_STAGE_CLAIM_TTL_MS = 30 * MINUTE_MS
export const ASSEMBLY_CLAIM_TTL_MS = 60 * MINUTE_MS

export function isClaimAvailable(
  claimedAt: string | null | undefined,
  ttlMs: number,
  nowMs = Date.now()
): boolean {
  if (!claimedAt) {
    return true
  }

  const claimedMs = new Date(claimedAt).getTime()
  if (Number.isNaN(claimedMs)) {
    return true
  }

  return nowMs - claimedMs >= ttlMs
}
