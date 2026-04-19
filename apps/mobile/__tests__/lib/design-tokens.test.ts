import {
  SPACING,
  TOUCH_TARGET,
  BORDER_RADIUS,
  ANIMATION,
} from '@/lib/shared/design'

describe('Design Tokens', () => {
  it('TOUCH_TARGET.min is at least 44 (Apple HIG)', () => {
    expect(TOUCH_TARGET.min).toBeGreaterThanOrEqual(44)
  })

  it('BORDER_RADIUS values are ascending', () => {
    expect(BORDER_RADIUS.xs).toBeLessThan(BORDER_RADIUS.sm)
    expect(BORDER_RADIUS.sm).toBeLessThan(BORDER_RADIUS.md)
    expect(BORDER_RADIUS.md).toBeLessThan(BORDER_RADIUS.lg)
    expect(BORDER_RADIUS.lg).toBeLessThan(BORDER_RADIUS.xl)
  })

  it('ANIMATION.pressScale is between 0.9 and 1', () => {
    expect(ANIMATION.pressScale).toBeGreaterThanOrEqual(0.9)
    expect(ANIMATION.pressScale).toBeLessThan(1)
  })

  it('all SPACING values are positive', () => {
    Object.values(SPACING).forEach((value) => {
      expect(value).toBeGreaterThan(0)
    })
  })
})
