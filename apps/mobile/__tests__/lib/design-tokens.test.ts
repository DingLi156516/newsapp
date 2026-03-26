import {
  SPACING,
  TOUCH_TARGET,
  BORDER_RADIUS,
  ANIMATION,
  SEMANTIC,
  ACCENT,
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

describe('SEMANTIC tokens', () => {
  const EXPECTED_ROLES = [
    'success',
    'info',
    'warning',
    'error',
    'primary',
    'muted',
  ] as const

  it('defines all 6 semantic roles', () => {
    const roles = Object.keys(SEMANTIC)
    expect(roles).toHaveLength(6)
    for (const role of EXPECTED_ROLES) {
      expect(SEMANTIC).toHaveProperty(role)
    }
  })

  it.each(EXPECTED_ROLES)(
    '%s has color, bg, and border keys',
    (role) => {
      const token = SEMANTIC[role]
      expect(token).toHaveProperty('color')
      expect(token).toHaveProperty('bg')
      expect(token).toHaveProperty('border')
      expect(typeof token.color).toBe('string')
      expect(typeof token.bg).toBe('string')
      expect(typeof token.border).toBe('string')
    },
  )

  it('all color values are non-empty strings', () => {
    for (const role of EXPECTED_ROLES) {
      const token = SEMANTIC[role]
      expect(token.color.length).toBeGreaterThan(0)
      expect(token.bg.length).toBeGreaterThan(0)
      expect(token.border.length).toBeGreaterThan(0)
    }
  })
})

describe('ACCENT backward compatibility', () => {
  it('ACCENT.amber matches SEMANTIC.warning.color', () => {
    expect(ACCENT.amber).toBe(SEMANTIC.warning.color)
  })

  it('ACCENT.amberBg matches SEMANTIC.warning.bg', () => {
    expect(ACCENT.amberBg).toBe(SEMANTIC.warning.bg)
  })

  it('ACCENT.amberBorder matches SEMANTIC.warning.border', () => {
    expect(ACCENT.amberBorder).toBe(SEMANTIC.warning.border)
  })

  it('ACCENT.red matches SEMANTIC.error.color', () => {
    expect(ACCENT.red).toBe(SEMANTIC.error.color)
  })
})
