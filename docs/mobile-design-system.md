# Mobile Design System — "Editorial Glass"

Design system reference for the Axiom News mobile app (`apps/mobile/`). Documents the tokens, primitives, and per-tab polish that make up the shipped UI kit at `apps/mobile/lib/ui/`.

> **Status: shipped.** Migration landed across four commits on `main`:
> - Tokens + primitives + Home/Sources adoption → `f584984a`
> - Blindspot tab adoption → `80f1240e`
> - Profile tab adoption → `56b38cf7`
> - Retire `design.ts` back-compat shims → `50d16965`
>
> Source of truth for code is [`apps/mobile/lib/ui/`](../apps/mobile/lib/ui). This doc captures the *why* (aesthetic rationale, design decisions, per-tab polish moves) that the TypeScript interfaces don't express.

> Scope: portable internal module at `apps/mobile/lib/ui/`. Zero leakage — tokens have no imports from `lib/shared/theme/`; primitives consume `useTheme()` for colors only and tokens for everything else. Copy-pasteable into another Expo app with a one-line theme-import swap.

---

## 1. Aesthetic philosophy

Name: **Editorial Glass.**

The current app already pairs two strong ideas: frosted-glass surfaces (via `GlassView` + `expo-blur`) and a serif display font (DM Serif Display) over a humanist sans (Inter). "Editorial Glass" names that direction and pushes it one step further — the app should feel like holding a print magazine with a glass cover: typography leads, surfaces recede, motion is restrained.

Three concrete moves that distinguish *opinionated polish* from the current state:

1. **Screen titles as display typography.** Today "Axiom" and "Sources" render at 24pt — cautious label-sized. Move to 30pt DM Serif Display with `-0.5` tracking. The Blindspot tab is already there; the new `ScreenHeader` primitive makes it canonical.
2. **Editorial hero on the feed.** The first story on Home renders like a magazine cover: 32pt headline, 2:3 aspect image (not 16:9), a single lean byline row, generous breathing room. Grid cards stay compact — the hierarchy reads as "front page vs. inside pages."
3. **Stronger paper grain.** The paper theme ships grain at `intensity: 0.1` today — barely visible. Bump to `0.18` and layer a second noise pass at `0.04` behind hero cards only, so parchment feels hand-held, not screenshot-flat. Dark theme is untouched.

Everything else — spacing, radii, motion — is inherited from the existing system, just *named*.

---

## 2. Module structure

```
apps/mobile/lib/ui/
├── tokens/                  # Pure data. Zero imports from lib/shared/theme/.
│   ├── spacing.ts
│   ├── radius.ts
│   ├── typography.ts
│   ├── motion.ts
│   ├── elevation.ts
│   ├── ink.ts
│   ├── touch.ts
│   └── index.ts
├── primitives/              # Portable components. Color via useTheme(), rhythm via tokens.
│   ├── Text.tsx
│   ├── Heading.tsx
│   ├── Button.tsx
│   ├── IconButton.tsx
│   ├── Pill.tsx
│   ├── Surface.tsx
│   └── Divider.tsx
├── composed/                # App-specific but reusable compositions.
│   ├── ScreenHeader.tsx
│   ├── Section.tsx
│   ├── StatCard.tsx
│   ├── SegmentedControl.tsx
│   ├── EmptyState.tsx
│   └── CollapsibleSection.tsx   (relocated)
├── index.ts                 # Single public import point.
└── README.md
```

**Public API** — one import line per screen:

```ts
import {
  // Primitives
  Text, Heading, Pill, Button, IconButton, Surface, Divider,
  // Composed
  ScreenHeader, Section, StatCard, SegmentedControl, EmptyState, CollapsibleSection,
  // Tokens
  SPACING, RADIUS, TEXT_STYLES, INK_TINT, ELEVATION, ENTRY_PRESETS, TOUCH_TARGET,
} from '@/lib/ui'
```

---

## 3. Tokens

### 3.1 `tokens/spacing.ts`

```ts
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const
```

Values unchanged from current `lib/shared/design.ts` — just relocated and re-exported.

### 3.2 `tokens/radius.ts`

```ts
export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,    // new — editorial hero card
  pill: 9999,
} as const
```

Added `xxl` for the new editorial hero card. Rename from `BORDER_RADIUS` → `RADIUS` for brevity at call sites.

### 3.3 `tokens/typography.ts` — full scale

```ts
export const FONT_FAMILY = {
  display: 'DMSerifDisplay',
  body:    'Inter',
  medium:  'Inter-Medium',
  semibold:'Inter-SemiBold',
  bold:    'Inter-Bold',
} as const

export const TEXT_STYLES = {
  hero:      { fontFamily: FONT_FAMILY.display,  fontSize: 32, lineHeight: 40, letterSpacing: -0.6 },
  display:   { fontFamily: FONT_FAMILY.display,  fontSize: 30, lineHeight: 38, letterSpacing: -0.5 },
  title:     { fontFamily: FONT_FAMILY.display,  fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
  heading:   { fontFamily: FONT_FAMILY.semibold, fontSize: 15, lineHeight: 22 },
  headingSm: { fontFamily: FONT_FAMILY.semibold, fontSize: 13, lineHeight: 20 },
  body:      { fontFamily: FONT_FAMILY.body,     fontSize: 14, lineHeight: 22 },
  bodySm:    { fontFamily: FONT_FAMILY.body,     fontSize: 13, lineHeight: 20 },
  caption:   { fontFamily: FONT_FAMILY.body,     fontSize: 12, lineHeight: 18 },
  small:     { fontFamily: FONT_FAMILY.body,     fontSize: 11, lineHeight: 16, letterSpacing: 0.2 },
  overline:  { fontFamily: FONT_FAMILY.medium,   fontSize: 10, lineHeight: 16, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  badge:     { fontFamily: FONT_FAMILY.semibold, fontSize: 10, lineHeight: 14, letterSpacing: 0.3 },
} as const

export type TextVariant = keyof typeof TEXT_STYLES
```

| Variant | Family | Size | LH | Tracking | Use |
|---------|--------|------|----|----------|-----|
| `hero` | DM Serif Display | 32 | 40 | -0.6 | Home editorial hero headline |
| `display` | DM Serif Display | 30 | 38 | -0.5 | Screen titles (Axiom, Sources, Blindspot, Dashboard) |
| `title` | DM Serif Display | 22 | 30 | -0.3 | Card headlines, modal titles |
| `heading` | Inter-SemiBold | 15 | 22 | 0 | Source-card name, dense headings |
| `headingSm` | Inter-SemiBold | 13 | 20 | 0 | Quick-action labels, stat labels |
| `body` | Inter | 14 | 22 | 0 | Paragraph text, long-form |
| `bodySm` | Inter | 13 | 20 | 0 | Secondary prose (subtitles) |
| `caption` | Inter | 12 | 18 | 0 | Metadata, timestamps |
| `small` | Inter | 11 | 16 | 0.2 | Counts, URLs |
| `overline` | Inter-Medium | 10 | 16 | 1.5 | Uppercase section labels |
| `badge` | Inter-SemiBold | 10 | 14 | 0.3 | Bias pills, tag pills |

### 3.4 `tokens/motion.ts`

```ts
import { Easing } from 'react-native-reanimated'
import { FadeIn, FadeInDown, SlideInDown, ZoomIn } from 'react-native-reanimated'

export const DURATION = { fast: 150, base: 200, slow: 300, slower: 400 } as const

export const SPRING = {
  stiff:  { stiffness: 300, damping: 30 },
  bouncy: { stiffness: 200, damping: 15 },
  snappy: { stiffness: 260, damping: 22 },
} as const

export const EASE = {
  inOut: Easing.inOut(Easing.cubic),
  out:   Easing.out(Easing.cubic),
} as const

export const ENTRY_PRESETS = {
  staggered: (i: number) =>
    FadeInDown.delay(Math.min(i, 8) * 60).springify().damping(18),
  heroFade:   FadeIn.duration(DURATION.slower),
  modalSlide: SlideInDown.springify().damping(20),
  pillRipple: ZoomIn.duration(DURATION.base).easing(EASE.out),
} as const
```

Replaces the scattered `FadeInDown.delay(Math.min(index, 8) * 60).springify().damping(18)` lines across all four tabs ([index.tsx:198](../apps/mobile/app/(tabs)/index.tsx), [blindspot.tsx:163](../apps/mobile/app/(tabs)/blindspot.tsx)).

### 3.5 `tokens/elevation.ts`

```ts
import { Platform } from 'react-native'

const shadow = (opacity: number, radius: number, y: number, elev: number) =>
  Platform.select({
    ios:     { shadowColor: '#000', shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: y } },
    android: { elevation: elev },
    default: {},
  })

export const ELEVATION = {
  none: {},
  sm: shadow(0.08, 8,  2,  2),
  md: shadow(0.12, 16, 6,  6),
  lg: shadow(0.18, 28, 12, 12),
} as const
```

Usage: glass cards → `sm`, editorial hero → `md`, bottom-sheet surfaces → `lg`.

### 3.6 `tokens/ink.ts`

```ts
export const INK_TINT = {
  whisper:  0.03,   // track bars, grid lines
  subtle:   0.05,   // muted surface bg
  soft:     0.06,   // active-tab glow
  standard: 0.10,   // active pill background
  strong:   0.15,   // notification-badge bg
  bold:     0.25,   // emphasized fills
} as const
```

Usage — theme-agnostic tint composition:

```ts
const bg = `rgba(${theme.inkRgb}, ${INK_TINT.standard})`
```

Replaces the inline magic numbers `0.03 / 0.05 / 0.06 / 0.1 / 0.15` found across every tab file.

### 3.7 `tokens/touch.ts`

```ts
export const TOUCH_TARGET = { min: 44, hitSlop: 12 } as const
export const HIT_SLOP = { top: 12, left: 12, right: 12, bottom: 12 } as const
```

---

## 4. Primitives

Each primitive is ~50–100 lines, typed, uses `useTheme()` for colors and `tokens/` for everything else. No new runtime dependencies — built on existing `GlassView`, `Animated.Pressable`, and `expo-blur`.

### 4.1 `Text`

**Props**

```ts
interface TextProps extends RNTextProps {
  readonly variant?: TextVariant   // default: 'body'
  readonly tone?: 'primary' | 'secondary' | 'tertiary' | 'muted' | 'accent'   // default: 'primary'
}
```

**Replaces**: ~200 inline `{ fontFamily: 'DMSerifDisplay', fontSize: 24, color: theme.text.primary }` triples across tab files.

**Example**

```tsx
<Text variant="body" tone="tertiary">
  {relativeTime}
</Text>

<Text variant="overline" tone="muted">Your Reading Spectrum</Text>
```

### 4.2 `Heading`

**Props**

```ts
interface HeadingProps extends RNTextProps {
  readonly variant: 'hero' | 'display' | 'title'   // required
  readonly tone?: TextProps['tone']
}
```

Thin wrapper — same component contract as `Text`, limited to display variants. Separate component for affordance ("use Heading for screen titles").

**Replaces**: every `<Text style={{ fontFamily: 'DMSerifDisplay', fontSize: 24 | 30 }}>` in tab headers.

**Example**

```tsx
<Heading variant="display">Axiom</Heading>
<Heading variant="hero">{article.headline}</Heading>
```

### 4.3 `Pill`

**Props**

```ts
interface PillProps {
  readonly label: string
  readonly active?: boolean
  readonly onPress?: () => void
  readonly leading?: React.ReactNode
  readonly trailing?: React.ReactNode
  readonly dismissible?: boolean   // renders ✕ and treats onPress as dismiss
  readonly testID?: string
}
```

**Replaces**: four hand-rolled pill styles.

| Current site | New usage |
|---|---|
| [sources.tsx:186](../apps/mobile/app/(tabs)/sources.tsx) sort pills | `<Pill active={mode === 'name'} onPress={...} label="A–Z" />` |
| [sources.tsx:341](../apps/mobile/app/(tabs)/sources.tsx) `FilterPillRow` | `<Pill active={selected === item} />` |
| `ActiveChip` [sources.tsx:294](../apps/mobile/app/(tabs)/sources.tsx) | `<Pill dismissible onPress={onClear} />` |
| [blindspot.tsx:218](../apps/mobile/app/(tabs)/blindspot.tsx) filter pills | `<Pill active={filter === pill.id} />` |

**Example**

```tsx
<Pill
  active={sortMode === 'bias'}
  onPress={() => setSortMode('bias')}
  label="Bias"
/>
```

### 4.4 `Button`

**Props**

```ts
interface ButtonProps {
  readonly variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'   // default: 'primary'
  readonly size?: 'sm' | 'md' | 'lg'                                     // default: 'md'
  readonly icon?: React.ComponentType<LucideProps>                       // leading icon
  readonly loading?: boolean
  readonly fullWidth?: boolean
  readonly onPress: () => void
  readonly children: React.ReactNode
  readonly testID?: string
}
```

**Variant behavior** (colors via `useTheme()`):

- `primary`   → `bg: theme.text.primary`, `fg: theme.surface.background` (ink-on-background)
- `secondary` → `bg: theme.surface.glass`, `fg: theme.text.primary`
- `destructive`→ `bg: theme.semantic.error.bg`, `fg: theme.semantic.error.color`, border
- `ghost`     → transparent bg, `fg: theme.text.secondary`, no border

Built-in press-scale animation (`ANIMATION.pressScale = 0.97`), haptic light on press.

**Replaces**:
- Sign-out button [profile.tsx:305](../apps/mobile/app/(tabs)/profile.tsx) → `<Button variant="destructive" icon={LogOut}>Sign Out</Button>`
- Sign-in CTA [profile.tsx:345](../apps/mobile/app/(tabs)/profile.tsx) → `<Button variant="primary" icon={LogIn}>Sign In</Button>`
- Modal "Clear All" / "Done" [sources.tsx:271](../apps/mobile/app/(tabs)/sources.tsx) → `<Button variant="secondary">Clear All</Button>` + `<Button variant="primary">Done</Button>`

### 4.5 `IconButton`

**Props**

```ts
interface IconButtonProps {
  readonly icon: React.ComponentType<LucideProps>
  readonly onPress: () => void
  readonly tone?: 'primary' | 'secondary' | 'tertiary' | 'accent'   // default: 'secondary'
  readonly size?: 'sm' | 'md' | 'lg'                                // default: 'md'
  readonly badge?: number                                           // optional notification-style count
  readonly testID?: string
  readonly accessibilityLabel: string                               // required
}
```

Always ≥44×44 hit area (`TOUCH_TARGET.min`). Renders a subtle ink-tint background on press (`INK_TINT.soft`). Badge renders as a top-right circle at `INK_TINT.strong`.

**Replaces**: every `<Pressable hitSlop={TOUCH_TARGET.hitSlop}>` wrapping a Lucide icon in a tab header.

**Example**

```tsx
<IconButton icon={SlidersHorizontal} onPress={openFilters} badge={activeFilterCount} accessibilityLabel="Filters" />
```

### 4.6 `Surface`

**Props**

```ts
interface SurfaceProps {
  readonly variant?: 'glass' | 'glassSm' | 'glassPill' | 'solid'   // default: 'glass'
  readonly elevation?: 'none' | 'sm' | 'md' | 'lg'                 // default: 'none'
  readonly accent?: string                                         // left-border accent color
  readonly glow?: string                                           // top-edge glow (forwarded to GlassView)
  readonly style?: ViewStyle
  readonly children: React.ReactNode
}
```

Wraps `GlassView` — adds `solid` variant (opaque `theme.surface.background`), shadow via `ELEVATION`, and accent left-border (used by source cards).

**Replaces**: direct `GlassView` usage with inline `borderLeftWidth: 3` / `borderLeftColor` patterns [sources.tsx:108](../apps/mobile/app/(tabs)/sources.tsx).

**Example**

```tsx
<Surface variant="glassSm" accent={BIAS_COLOR[source.bias]} elevation="sm">
  {/* source card contents */}
</Surface>
```

### 4.7 `Divider`

**Props**

```ts
interface DividerProps {
  readonly orientation?: 'horizontal' | 'vertical'   // default: 'horizontal'
  readonly inset?: number                            // margin on both sides
  readonly tone?: 'subtle' | 'strong'                // maps to INK_TINT
}
```

New primitive. Needed for the Blindspot filter-row split (skew group ↕ topic group).

### 4.8 `ScreenHeader` (composed)

**Props**

```ts
interface ScreenHeaderProps {
  readonly title: string
  readonly subtitle?: string
  readonly leading?: React.ReactNode
  readonly trailing?: readonly React.ReactNode[]
}
```

Layout: row with leading slot, stacked title/subtitle center-left, trailing slot array right. Uses `Heading variant="display"` for title, `Text variant="bodySm" tone="tertiary"` for subtitle.

**Replaces**: hand-rolled header rows in all four tabs (see §5 polish brief).

**Example**

```tsx
<ScreenHeader
  title="Blindspot"
  subtitle="Stories under-covered on one side of the political spectrum."
  leading={<Eye size={22} color={theme.text.primary} />}
  trailing={[
    <IconButton icon={Settings2} onPress={openEdit} accessibilityLabel="Edit feed" />,
  ]}
/>
```

### 4.9 `Section` (composed)

**Props**

```ts
interface SectionProps {
  readonly label: string
  readonly trailing?: React.ReactNode
  readonly children: React.ReactNode
}
```

Wraps children with an overline label row. Standardizes [profile.tsx:38](../apps/mobile/app/(tabs)/profile.tsx) `sectionLabel` inline style.

**Example**

```tsx
<Section label="Your Reading Spectrum">
  <BiasDonutChart distribution={profile.userDistribution ?? []} />
</Section>
```

### 4.10 `StatCard` (composed)

**Props**

```ts
interface StatCardProps {
  readonly value: number
  readonly label: string
  readonly glow?: string          // color for glass-edge glow (warnings)
  readonly accent?: string        // color override for value
  readonly animated?: boolean     // default true — uses AnimatedCounter
}
```

Wraps `Surface variant="glassSm"` + `AnimatedCounter` + `Text variant="small" tone="tertiary"`.

**Replaces**: three stat cards in Profile [profile.tsx:111–124](../apps/mobile/app/(tabs)/profile.tsx).

**Example**

```tsx
<View style={{ flexDirection: 'row', gap: SPACING.sm }}>
  <StatCard value={profile.totalStoriesRead} label="Stories Read" />
  <StatCard value={readCount} label="This Session" />
  <StatCard value={profile.blindspots.length} label="Blindspots" glow={theme.semantic.warning.color} />
</View>
```

### 4.11 `SegmentedControl` (composed)

**Props**

```ts
interface SegmentedControlProps<T extends string> {
  readonly value: T
  readonly onChange: (next: T) => void
  readonly options: readonly { value: T; label: string }[]
  readonly testID?: string
}
```

Renders `<Pill>` options in a row with a single active selection. Haptic light on change.

**Replaces**: sort-mode row [sources.tsx:176](../apps/mobile/app/(tabs)/sources.tsx).

### 4.12 `EmptyState` (composed)

Existing `components/molecules/EmptyStateView.tsx` — relocated to `lib/ui/composed/EmptyState.tsx` with tightened types. Behavior unchanged.

### 4.13 `CollapsibleSection` (composed)

Existing `components/molecules/CollapsibleSection.tsx` — relocated. Adopted on the Profile screen for "Detailed Breakdown" and "Suggestions."

---

## 5. Per-tab polish

Each tab landed two layers of change: **(a)** mechanical — replace inline styles with primitives (files shrank 30–40%), **(b)** opinionated — specific hierarchy/UX moves aligned with Editorial Glass.

### 5.1 Home — [`app/(tabs)/index.tsx`](../apps/mobile/app/(tabs)/index.tsx)

**Mechanical — shipped**
- [x] Header row → `<ScreenHeader title="Axiom" leading={<OfflineIndicator />} trailing={[guideIconButton, editFeedIconButton]} />`
- [x] Card entry → `entering={ENTRY_PRESETS.staggered(index)}`

**Opinionated — shipped**
- [x] "Axiom" 24pt → 30pt DM Serif Display tracked -0.5 via `<Heading variant="display">`.
- [x] `EditorialHeroCard` organism replacing `HeroCard` on position 0: 2:3 aspect image, 32pt headline, single-line byline, `ENTRY_PRESETS.heroFade`.
- [x] Tabs-vs-tags hierarchy rebalanced: `UnifiedTabBar` keeps its weight; promoted tags drop to 11pt with `INK_TINT.subtle` bg when active.
- [ ] Guide icon relocation to first-run/empty state FAB — **deferred**, still in the header.

### 5.2 Sources — [`app/(tabs)/sources.tsx`](../apps/mobile/app/(tabs)/sources.tsx)

**Mechanical — shipped**
- [x] Header → `<ScreenHeader title="Sources" trailing={[<IconButton icon={SlidersHorizontal} badge={activeFilterCount} ... />]} />`
- [x] Sort-mode row → `<SegmentedControl value={sortMode} onChange={setSortMode} options=[A-Z / Bias / Factuality] />`
- [x] Active filter chips → `<Pill dismissible />` (removed the local `ActiveChip`).
- [x] Filter-sheet pill rows → `<Pill active />` (removed the local `FilterPillRow`).
- [x] Source card → `<Surface variant="glassSm" accent={BIAS_COLOR[item.bias]} elevation="sm">`.

**Opinionated — shipped**
- [x] Grouping when sort = Bias or Factuality: sticky `<Section>` header rows inserted between groups via a `ListRow` union (`{kind:'header'} | {kind:'source'}`).
- [x] Source card hierarchy: name at `<Text variant="heading">`, bias + factuality inline, URL collapsed to bare host via a `barehost` helper, logo 42 → 48.
- [x] Filter-sheet warmer framing: one-line subtitle under the "Filters" heading.

### 5.3 Blindspot — [`app/(tabs)/blindspot.tsx`](../apps/mobile/app/(tabs)/blindspot.tsx) — canonical `ScreenHeader` reference

**Mechanical — shipped**
- [x] Header → `<ScreenHeader title="Blindspot" subtitle="..." leading={<Eye size={22} ... />} titleTestID="blindspot-header" />`
- [x] Filter pills → `<Pill>` × 5.

**Opinionated — shipped**
- [x] "Under-covered" as a card footer band: `NexusCard` extended with `footerBand?: { label; tone: 'warning' | 'info' }`. Blindspot feeds `skewFooterBand(article)` into every card — warning tint for right-skew, info tint for left-skew.
- [x] Filter taxonomy split with a vertical `<Divider />` between skew pills (All / Right-skew / Left-skew) and topic pills (Politics / Tech) — signals two independent filter dimensions.

### 5.4 Profile — [`app/(tabs)/profile.tsx`](../apps/mobile/app/(tabs)/profile.tsx) — dashboard refit

**Mechanical — shipped**
- [x] Header → `<ScreenHeader title="Dashboard" subtitle={user?.email ?? 'Guest'} trailing={[<IconButton icon={Settings} ... />]} />`
- [x] Every inline `sectionLabel` → `<Section label="…">`.
- [x] Stat row → `<StatCard>` × 3. Blindspots card keeps its warning glow + accent when count > 0.
- [x] Sign-out → `<Button variant="destructive" icon={LogOut} fullWidth>Sign Out</Button>`.
- [x] Sign-in CTA → `<Surface>` containing `<Heading variant="title">` + `<Button variant="primary" icon={LogIn}>Sign In</Button>`.

**Opinionated — shipped**
- [x] Quick-action differentiation — each destination keeps its own icon tone: History `text.tertiary`, Saved `text.primary`, Guide `semantic.info.color`.
- [x] Extracted `BiasDistributionList` molecule (7-bar user-vs-overall breakdown with blindspot highlighting) to [`components/molecules/BiasDistributionList.tsx`](../apps/mobile/components/molecules/BiasDistributionList.tsx).
- [x] Collapsibles: "Detailed Breakdown" wrapped in `<CollapsibleSection defaultExpanded>`; "Suggested For You" in a closed-by-default `<CollapsibleSection>` with a subtitle.
- [x] Visual rhythm — top-level `gap: SPACING.lg` between blocks.

---

## 6. `design.ts` — final state after migration

[`lib/shared/design.ts`](../apps/mobile/lib/shared/design.ts) is now a thin source-compat re-export plus the tokens that don't need a theme. The deprecated shims were removed in commit `50d16965`.

| Export | Status |
|---|---|
| `SPACING` | Re-exported from `lib/ui/tokens/spacing.ts`. |
| `BORDER_RADIUS` | Re-exported as `RADIUS` from `lib/ui/tokens/radius.ts` (adds `xxl`). |
| `TOUCH_TARGET` | Re-exported from `lib/ui/tokens/touch.ts`. |
| `FONT`, `BADGE`, `FACTUALITY`, `ANIMATION` | Kept — still have active consumers; not part of the Editorial Glass token set. |
| `SITE_URL` | Kept — runtime config. |
| `GLASS`, `SEMANTIC`, `TEXT_OPACITY`, `ACCENT` | **Removed.** Call sites consume `useTheme().surface/text/semantic.*` or `INK_TINT` directly. |

New code should import from `@/lib/ui` (primitives, composed, tokens) — not `@/lib/shared/design`.

---

## 7. Portability check

The `lib/ui/` module must compile in a fresh Expo app with **only the theme-import line changed**. Pseudo-dry-run:

```ts
// apps/mobile/lib/ui/primitives/Text.tsx
import { useTheme } from '@/lib/shared/theme'   // ← only line that leaks

// In a fresh Expo app, swap to:
import { useTheme } from '@/my-app/theme'
```

Required contract for the consumer `useTheme()`:
- Returns an object matching the `Theme` interface from [`lib/shared/theme/types.ts`](../apps/mobile/lib/shared/theme/types.ts)
- Provides `surface.{background,glass,glassSm,glassPill,border,borderPill}`
- Provides `text.{primary,secondary,tertiary,muted}`
- Provides `semantic.{success,info,warning,error,primary,muted}` each as `SemanticColor`
- Provides `inkRgb` (comma-separated RGB triplet string)
- Provides `blurTint`, `statusBarStyle`, `texture`

Anything else (spacing, typography, radii, motion, elevation, ink-tint) is self-contained in `lib/ui/tokens/` with zero external imports. Verified by: no `import … from '@/lib/shared/theme'` line inside `lib/ui/tokens/**`.

---

## 8. Follow-ups / deferred

- **Guide icon relocation** (Home §5.1) — not yet moved to an empty-state FAB; `BookOpen` still lives in the header.
- **Paper-theme grain bump (0.10 → 0.18)** — not yet applied; tracked separately.

---

## 9. How the migration rolled out

Shipped over four commits on `main`:

| Commit | Scope |
|--------|-------|
| `f584984a` | Tokens + primitives + Home + Sources adoption (was Phases 1–4). |
| `80f1240e` | Blindspot tab + `NexusCard.footerBand` extension (was Phase 5). |
| `56b38cf7` | Profile tab + `BiasDistributionList` extraction (was Phase 6). |
| `50d16965` | Remove deprecated `design.ts` aliases (`GLASS`, `SEMANTIC`, `TEXT_OPACITY`, `ACCENT`) (was Phase 7). |

Each commit passed `tsc --noEmit`, full Jest suite, and an independent Codex adversarial review (zero remaining P1/P2 findings).

---

## 10. References

- [apps/mobile/lib/ui/](../apps/mobile/lib/ui) — canonical source for tokens, primitives, composed.
- [apps/mobile/lib/shared/design.ts](../apps/mobile/lib/shared/design.ts) — source-compat re-exports + legacy FONT/BADGE/FACTUALITY/ANIMATION constants.
- [apps/mobile/lib/shared/theme/types.ts](../apps/mobile/lib/shared/theme/types.ts) — theme contract consumed by `Surface` / `Text` / `Pill`.
- [apps/mobile/lib/shared/theme/paper.ts](../apps/mobile/lib/shared/theme/paper.ts) — paper theme.
- [apps/mobile/components/ui/GlassView.tsx](../apps/mobile/components/ui/GlassView.tsx) — wrapped by `Surface`.
- [apps/mobile/components/atoms/AnimatedCounter.tsx](../apps/mobile/components/atoms/AnimatedCounter.tsx) — reused inside `StatCard`.
- [apps/mobile/components/molecules/BiasDistributionList.tsx](../apps/mobile/components/molecules/BiasDistributionList.tsx) — extracted from Profile in commit `56b38cf7`.
- [docs/mobile-components.md](mobile-components.md) — component inventory.
- [docs/mobile-architecture.md](mobile-architecture.md) — mobile architecture.
