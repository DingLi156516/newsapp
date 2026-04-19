/**
 * Verifies that `lib/shared/design.ts` still exposes the legacy token names
 * after Phase 1, backed by `lib/ui/tokens/*`. This guards against a break
 * while existing screens continue importing from `@/lib/shared/design`.
 */

import {
  SPACING as DESIGN_SPACING,
  BORDER_RADIUS,
  TOUCH_TARGET as DESIGN_TOUCH,
} from '@/lib/shared/design'
import { SPACING, RADIUS, TOUCH_TARGET } from '@/lib/ui/tokens'

describe('design.ts re-exports from lib/ui/tokens', () => {
  it('SPACING is the same reference', () => {
    expect(DESIGN_SPACING).toBe(SPACING)
  })

  it('BORDER_RADIUS is the same reference as RADIUS', () => {
    expect(BORDER_RADIUS).toBe(RADIUS)
  })

  it('TOUCH_TARGET is the same reference', () => {
    expect(DESIGN_TOUCH).toBe(TOUCH_TARGET)
  })

  it('legacy BORDER_RADIUS still exposes xs through pill', () => {
    expect(BORDER_RADIUS.xs).toBe(6)
    expect(BORDER_RADIUS.pill).toBe(9999)
  })
})
