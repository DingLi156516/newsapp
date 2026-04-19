import {
  SPACING,
  RADIUS,
  FONT_FAMILY,
  TEXT_STYLES,
  DURATION,
  SPRING,
  ENTRY_PRESETS,
  ELEVATION,
  INK_TINT,
  TOUCH_TARGET,
  HIT_SLOP,
} from '@/lib/ui/tokens'

describe('lib/ui/tokens — SPACING', () => {
  it('exposes the 4pt rhythm scale', () => {
    expect(SPACING).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 })
  })

  it('values ascend', () => {
    expect(SPACING.xs).toBeLessThan(SPACING.sm)
    expect(SPACING.sm).toBeLessThan(SPACING.md)
    expect(SPACING.md).toBeLessThan(SPACING.lg)
    expect(SPACING.lg).toBeLessThan(SPACING.xl)
    expect(SPACING.xl).toBeLessThan(SPACING.xxl)
  })
})

describe('lib/ui/tokens — RADIUS', () => {
  it('includes xxl for the editorial hero card', () => {
    expect(RADIUS.xxl).toBe(28)
  })

  it('values ascend through pill', () => {
    expect(RADIUS.xs).toBeLessThan(RADIUS.sm)
    expect(RADIUS.sm).toBeLessThan(RADIUS.md)
    expect(RADIUS.md).toBeLessThan(RADIUS.lg)
    expect(RADIUS.lg).toBeLessThan(RADIUS.xl)
    expect(RADIUS.xl).toBeLessThan(RADIUS.xxl)
    expect(RADIUS.xxl).toBeLessThan(RADIUS.pill)
  })
})

describe('lib/ui/tokens — typography', () => {
  const EXPECTED_VARIANTS = [
    'hero',
    'display',
    'title',
    'heading',
    'headingSm',
    'body',
    'bodySm',
    'caption',
    'small',
    'overline',
    'badge',
  ] as const

  it('ships all 11 text variants', () => {
    const keys = Object.keys(TEXT_STYLES)
    expect(keys).toHaveLength(EXPECTED_VARIANTS.length)
    for (const variant of EXPECTED_VARIANTS) {
      expect(TEXT_STYLES).toHaveProperty(variant)
    }
  })

  it.each(EXPECTED_VARIANTS)(
    '%s variant defines fontFamily, fontSize, and lineHeight',
    (variant) => {
      const style = TEXT_STYLES[variant]
      expect(typeof style.fontFamily).toBe('string')
      expect(typeof style.fontSize).toBe('number')
      expect(typeof style.lineHeight).toBe('number')
    },
  )

  it('display variants use DMSerifDisplay', () => {
    expect(TEXT_STYLES.hero.fontFamily).toBe(FONT_FAMILY.display)
    expect(TEXT_STYLES.display.fontFamily).toBe(FONT_FAMILY.display)
    expect(TEXT_STYLES.title.fontFamily).toBe(FONT_FAMILY.display)
  })

  it('hero and display titles use tight negative tracking', () => {
    expect(TEXT_STYLES.hero.letterSpacing).toBeLessThan(0)
    expect(TEXT_STYLES.display.letterSpacing).toBeLessThan(0)
  })

  it('overline variant is uppercase with wide tracking', () => {
    expect(TEXT_STYLES.overline.textTransform).toBe('uppercase')
    expect(TEXT_STYLES.overline.letterSpacing).toBeGreaterThan(1)
  })
})

describe('lib/ui/tokens — motion', () => {
  it('exposes duration tokens in ascending order', () => {
    expect(DURATION.fast).toBeLessThan(DURATION.base)
    expect(DURATION.base).toBeLessThan(DURATION.slow)
    expect(DURATION.slow).toBeLessThan(DURATION.slower)
  })

  it('spring configs define stiffness and damping', () => {
    for (const key of ['stiff', 'bouncy', 'snappy'] as const) {
      expect(SPRING[key].stiffness).toBeGreaterThan(0)
      expect(SPRING[key].damping).toBeGreaterThan(0)
    }
  })

  it('staggered preset returns a reanimated entry layout', () => {
    const entry = ENTRY_PRESETS.staggered(0)
    expect(entry).toBeDefined()
  })

  it('staggered preset is callable for any index without throwing', () => {
    expect(() => ENTRY_PRESETS.staggered(42)).not.toThrow()
  })
})

describe('lib/ui/tokens — elevation', () => {
  it('exposes none/sm/md/lg tiers', () => {
    expect(ELEVATION).toHaveProperty('none')
    expect(ELEVATION).toHaveProperty('sm')
    expect(ELEVATION).toHaveProperty('md')
    expect(ELEVATION).toHaveProperty('lg')
  })

  it('none is an empty style object', () => {
    expect(ELEVATION.none).toEqual({})
  })
})

describe('lib/ui/tokens — INK_TINT', () => {
  it('exposes six named opacities', () => {
    expect(Object.keys(INK_TINT)).toEqual([
      'whisper',
      'subtle',
      'soft',
      'standard',
      'strong',
      'bold',
    ])
  })

  it('values ascend', () => {
    expect(INK_TINT.whisper).toBeLessThan(INK_TINT.subtle)
    expect(INK_TINT.subtle).toBeLessThan(INK_TINT.soft)
    expect(INK_TINT.soft).toBeLessThan(INK_TINT.standard)
    expect(INK_TINT.standard).toBeLessThan(INK_TINT.strong)
    expect(INK_TINT.strong).toBeLessThan(INK_TINT.bold)
  })

  it('values are valid opacities (0–1)', () => {
    for (const value of Object.values(INK_TINT)) {
      expect(value).toBeGreaterThan(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})

describe('lib/ui/tokens — touch', () => {
  it('TOUCH_TARGET.min meets Apple HIG (≥44)', () => {
    expect(TOUCH_TARGET.min).toBeGreaterThanOrEqual(44)
  })

  it('HIT_SLOP applies equally on all four sides', () => {
    expect(HIT_SLOP.top).toBe(HIT_SLOP.left)
    expect(HIT_SLOP.left).toBe(HIT_SLOP.right)
    expect(HIT_SLOP.right).toBe(HIT_SLOP.bottom)
  })
})
