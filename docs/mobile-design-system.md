# Mobile Design System — "Editorial Glass"

Design system spec for the Axiom News mobile app (`apps/mobile/`). This document is a **blueprint**: it defines tokens, primitives, and per-tab polish moves. No code under `apps/mobile/lib/ui/` has been written yet — this doc is what a future implementation session executes against.

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

## 5. Per-tab polish brief

Each tab has two layers: **(a)** mechanical swaps — replace inline styles with primitives (low-risk, files shrink ~30–40%), **(b)** opinionated polish — specific hierarchy/UX moves aligned with Editorial Glass.

### 5.1 Home — [`app/(tabs)/index.tsx`](../apps/mobile/app/(tabs)/index.tsx)

**(a) Mechanical**
- Header row (lines 228–255) → `<ScreenHeader title="Axiom" leading={<OfflineIndicator />} trailing={[guideIconButton, editFeedIconButton]} />`
- Card entry (line 198) → `entering={ENTRY_PRESETS.staggered(index)}`

**(b) Opinionated polish**
- **Bold display title.** "Axiom" 24pt → 30pt DM Serif Display tracked -0.5 via `<Heading variant="display">`.
- **Editorial hero.** Replace current `HeroCard` with new `EditorialHeroCard` component in `components/organisms/`: 2:3 aspect image (not 16:9), 32pt headline (`<Heading variant="hero">`), single-line byline (source logo · relative time · factuality dot), `SPACING.lg` breathing room above the grid.
- **Tabs vs tags hierarchy.** `UnifiedTabBar` + promoted-tag row currently competes — two equal-weight pill rows. Proposal: keep tabs at current weight, drop promoted tags to `<Text variant="small" tone="tertiary">` with no pill bg and a subtle `INK_TINT.subtle` chip when active. Promoted tags read as *filters on the feed*, not *alternate navigation*.
- **Guide icon relocation** (deferred to Phase 3): move `BookOpen` out of the header; render as a floating action button on first-run / empty states only.

### 5.2 Sources — [`app/(tabs)/sources.tsx`](../apps/mobile/app/(tabs)/sources.tsx)

**(a) Mechanical**
- Header (lines 150–166) → `<ScreenHeader title="Sources" trailing={[<IconButton icon={SlidersHorizontal} badge={activeFilterCount} onPress={openFilters} accessibilityLabel="Filters" />]} />`
- Sort-mode row (lines 176–201) → `<SegmentedControl value={sortMode} onChange={setSortMode} options={[{value:'name',label:'A–Z'},{value:'bias',label:'Bias'},{value:'factuality',label:'Factuality'}]} />`
- Active filter chips (line 208–219) → `<Pill dismissible onPress={clear} />` (removes `ActiveChip` local component)
- Filter-sheet pill rows (lines 316–360) → `<Pill active={selected === item} />` (removes `FilterPillRow` local component)
- Source card (lines 108–126) → `<Surface variant="glassSm" accent={BIAS_COLOR[item.bias]} elevation="sm">`

**(b) Opinionated polish**
- **Grouping when sort = Bias or Factuality.** Today sorting re-orders a flat list with no visual break. Add sticky `<Section label="FAR-LEFT">` headers between groups. A 50-source list becomes scannable.
- **Source card hierarchy.** Current stack (name / bias+factuality / URL) has equal visual weight. Proposal: name at `<Text variant="heading">`, bias pill + factuality bar inline below, URL collapsed to bare host (`nytimes.com` not full URL) at `<Text variant="small" tone="muted">`. Logo 42→48 for better balance.
- **Filter sheet warmer framing.** Add one-line subtitle under "Filters" heading: "Narrow down by bias, factuality, ownership, region." via `<Text variant="caption" tone="tertiary">`.

### 5.3 Blindspot — [`app/(tabs)/blindspot.tsx`](../apps/mobile/app/(tabs)/blindspot.tsx)

Already closest to the target aesthetic — becomes the canonical `ScreenHeader` reference.

**(a) Mechanical**
- Header (lines 193–206) → `<ScreenHeader title="Blindspot" subtitle="Stories under-covered on one side of the political spectrum." leading={<Eye size={22} color={theme.text.primary} />} />`
- Filter pills (lines 209–234) → `<Pill>` × 5

**(b) Opinionated polish**
- **"Under-covered" as card footer band.** Today the skew copy renders as a caption below the card ([blindspot.tsx:180](../apps/mobile/app/(tabs)/blindspot.tsx)) — reads orphaned. Move inside the card as a thin colored-band footer: `theme.semantic.warning.bg` for right-skew, `theme.semantic.info.bg` for left-skew, with skew copy + arrow icon. Requires extending `NexusCard` with `footerBand?: { label: string; tone: 'warning' | 'info' }` — cross-tab benefit.
- **Filter row taxonomy split.** Current row mixes skew (Right-skew/Left-skew) with topic (Politics/Tech) in one pill group. Insert a vertical `<Divider orientation="vertical" />` between skew and topic pills to signal two independent filter dimensions. Alternative (more structural): two stacked `<SegmentedControl>`s.

### 5.4 Profile — [`app/(tabs)/profile.tsx`](../apps/mobile/app/(tabs)/profile.tsx)

Longest polish opportunity — dashboard with 8+ stacked sections.

**(a) Mechanical**
- Header (lines 46–58) → `<ScreenHeader title="Dashboard" subtitle={user?.email ?? 'Guest'} trailing={[<IconButton icon={Settings} onPress={() => router.push('/settings')} accessibilityLabel="Settings" />]} />`
- Each inline `sectionLabel` (line 38) → `<Section label="…">` wrapping the following block
- Stat row (lines 111–124) → `<StatCard value={...} label="…" />` × 3
- Sign-out button (lines 305–322) → `<Button variant="destructive" icon={LogOut}>Sign Out</Button>`
- Sign-in CTA card (lines 326–361) → `<Surface><Heading variant="title">Unlock Bias Calibration</Heading><Button variant="primary" icon={LogIn}>Sign In</Button></Surface>`

**(b) Opinionated polish**
- **Quick-action differentiation.** Three identical glass pills (History / Saved / Guide) — give each a distinctive icon tone: History `tone="tertiary"`, Saved `tone="primary"`, Guide `tone="accent"` (semantic.info). Scannable.
- **Extract `BiasDistributionList` molecule.** The 7-bar breakdown block ([profile.tsx:178–221](../apps/mobile/app/(tabs)/profile.tsx)) is ~100 lines inline. Pull into `components/molecules/BiasDistributionList.tsx` taking `userDistribution` + `overallDistribution` + `blindspots`. Cross-app benefit — the web app renders the same chart.
- **Collapsible dense sections.** Wrap "Detailed Breakdown" (default open) and "Suggested For You" (default closed) in `<CollapsibleSection>`. Dashboard stays glanceable; details on tap.
- **Visual rhythm.** Add `gap: SPACING.lg` between top-level blocks in the root `ScrollView`: banner → stats → chart → breakdown → blindspots → suggestions → sign-out. Small change, big readability win.

---

## 6. Migration — from `design.ts` to primitives

Current `lib/shared/design.ts` ([file](../apps/mobile/lib/shared/design.ts)) exports a mix of live and deprecated tokens:

| Current export | Migration target |
|---|---|
| `SPACING` | → `lib/ui/tokens/spacing.ts` (same values, re-exported) |
| `BORDER_RADIUS` | → `lib/ui/tokens/radius.ts` as `RADIUS` (rename + adds `xxl`) |
| `FONT` | → folded into `lib/ui/tokens/typography.ts` `TEXT_STYLES` |
| `BADGE` | → folded into `TEXT_STYLES.badge` + `RADIUS.pill` |
| `FACTUALITY` | unchanged — stays in `lib/shared/types.ts` (domain data, theme-invariant) |
| `ANIMATION` | → `lib/ui/tokens/motion.ts` (`SPRING`, `DURATION`) |
| `TOUCH_TARGET` | → `lib/ui/tokens/touch.ts` |
| `GLASS` (deprecated) | → remove. Use `useTheme().surface.*` directly. |
| `SEMANTIC` (deprecated) | → remove. Use `useTheme().semantic.*` directly. |
| `TEXT_OPACITY` (deprecated) | → replaced by `INK_TINT` + `useTheme().text.*` |
| `ACCENT` (deprecated) | → remove. Use `useTheme().semantic.warning/error`. |

**Strategy**: Phase 1 PR re-exports new tokens from old paths (non-breaking). Phase 3 PRs migrate each tab. Final PR deletes deprecated aliases.

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

## 8. Open questions / decisions deferred to implementation

1. **`EditorialHeroCard` — new component or `HeroCard` refactor?** Spec prefers new component so existing `HeroCard` remains available for non-feed contexts. Decide at Phase 3.
2. **`NexusCard` `footerBand` prop.** Clean extension for Blindspot's under-covered band. Decide whether to generalize or scope to blindspot-only.
3. **`Pill` vs `Chip` naming.** Using `Pill` for consistency with `glass-pill`. Some teams prefer `Chip` (Material convention). Team preference.
4. **Paper-theme grain bump (0.10 → 0.18).** Aesthetic call — preview on device before committing.
5. **Grouping in Sources.** Sticky section headers add visual weight. If they feel heavy on small screens, fall back to a subtle inline divider.

---

## 9. Execution plan

Seven PRs, each independently shippable, each ≤300 diff lines:

| PR | Scope | Breaking? |
|----|-------|-----------|
| 1 | `lib/ui/tokens/` + re-exports from `design.ts` | No |
| 2 | `lib/ui/primitives/` + `lib/ui/composed/` + dev showcase screen (`app/_dev/ui.tsx`, `__DEV__` only) | No |
| 3 | Home tab refactor (includes `EditorialHeroCard`) | Visual change |
| 4 | Sources tab refactor (includes grouping when sort=Bias) | Visual change |
| 5 | Blindspot tab refactor (includes card-footer band, `NexusCard` extension) | Visual change |
| 6 | Profile tab refactor (extracts `BiasDistributionList`, adds collapsibles) | Visual change |
| 7 | Remove deprecated `design.ts` aliases (`GLASS`, `SEMANTIC`, `TEXT_OPACITY`, `ACCENT`) | Clean-up |

Each PR gates on: `npm run lint`, `npm run typecheck`, `npm test` (≥80% coverage on new files), and Maestro E2E for the refactored tab. Visual regressions verified by manual screenshot diff and the dev showcase screen in both themes.

---

## 10. References

- [apps/mobile/lib/shared/design.ts](../apps/mobile/lib/shared/design.ts) — current token source
- [apps/mobile/lib/shared/theme/types.ts](../apps/mobile/lib/shared/theme/types.ts) — theme contract (unchanged)
- [apps/mobile/lib/shared/theme/paper.ts](../apps/mobile/lib/shared/theme/paper.ts) — paper theme (grain bump target)
- [apps/mobile/components/ui/GlassView.tsx](../apps/mobile/components/ui/GlassView.tsx) — wrapped by `Surface`
- [apps/mobile/components/atoms/AnimatedCounter.tsx](../apps/mobile/components/atoms/AnimatedCounter.tsx) — reused inside `StatCard`
- [docs/mobile-components.md](mobile-components.md) — current component inventory (to be updated after Phase 2)
- [docs/mobile-architecture.md](mobile-architecture.md) — architecture (to be updated after Phase 1)
