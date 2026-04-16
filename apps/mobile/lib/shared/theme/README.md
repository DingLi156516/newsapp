# Mobile Theme Module

Runtime-switchable theme tokens for the Expo app. Components consume colors
via `useTheme()` instead of hardcoding `rgba()` / hex strings, which lets a
light (or any alternate) theme ship later without touching every component.

## What lives where

| Token kind                       | Location                               | Theme-aware? |
| -------------------------------- | -------------------------------------- | ------------ |
| Surface / text / semantic colors | `@/lib/shared/theme` (this module)     | **Yes**      |
| Glass tint, status bar style     | `@/lib/shared/theme`                   | **Yes**      |
| Spacing, font sizes, radii       | `@/lib/shared/design`                  | No           |
| Badge / animation / touch target | `@/lib/shared/design`                  | No           |
| Domain colors (bias, factuality) | `@/lib/shared/types`                   | No (data)    |

Domain colors are semantically meaningful — left-blue, right-red, high-factuality-green —
so they stay invariant across themes.

## Using `useTheme()`

```tsx
import { useTheme } from '@/lib/shared/theme'

export function MyCard() {
  const theme = useTheme()
  return (
    <View style={{
      backgroundColor: theme.surface.glass,
      borderColor: theme.surface.border,
    }}>
      <Text style={{ color: theme.text.primary }}>Hello</Text>
    </View>
  )
}
```

A missing provider falls back to `darkTheme` — unit tests that render a
component in isolation keep working with no extra wrapping.

## Migration checklist (per component)

Convert one component at a time:

1. Add `const theme = useTheme()` at the top of the component.
2. Replace hardcoded values:
   - `'rgba(26, 26, 26, 0.4)'` → `theme.surface.glass`
   - `'rgba(26, 26, 26, 0.5)'` → `theme.surface.glassSm`
   - `'rgba(26, 26, 26, 0.6)'` → `theme.surface.glassPill`
   - `'rgba(255, 255, 255, 0.08)'` → `theme.surface.border`
   - `'rgba(255, 255, 255, 0.1)'` → `theme.surface.borderPill`
   - `'white'` / `'#fff'` / `'#FFFFFF'` → `theme.text.primary`
   - `'rgba(255, 255, 255, 0.6)'` → `theme.text.secondary`
   - `'rgba(255, 255, 255, 0.4)'` → `theme.text.tertiary`
   - `'rgba(255, 255, 255, 0.35)'` → `theme.text.muted`
   - `GLASS.*` → `theme.surface.*` (drop the `GLASS` import)
   - `SEMANTIC[role]` → `theme.semantic[role]` (drop the `SEMANTIC` import)
3. Keep using `SPACING`, `FONT`, `BORDER_RADIUS`, `ANIMATION`, `BADGE`,
   `TOUCH_TARGET` from `@/lib/shared/design`.
4. For `<BlurView>`, pass `tint={theme.blurTint}` instead of hardcoding `"dark"`.
5. For `<StatusBar>`, pass `style={theme.statusBarStyle}`.

### Reanimated worklets

Worklets (`useAnimatedStyle`, `useDerivedValue`, …) run on the UI thread and
cannot safely access React context. Capture the color as a plain value *outside*
the worklet and close over it:

```tsx
const theme = useTheme()
const borderColor = theme.surface.border        // captured on JS thread
const circleStyle = useAnimatedStyle(() => ({
  backgroundColor: `rgba(255, 255, 255, ${pulse.value})`,
  borderColor,                                  // closed over, no context access
}))
```

Animating opacity over a fixed rgba base is fine; if you later need to animate
between two theme colors, pass both into the worklet as captured locals.

### `GlassView` and Android

`GlassView` has an iOS path (BlurView + tinted backdrop) and an Android path
(plain semi-transparent `View`). Both paths need the theme applied — don't
migrate only one. Test on both platforms or at least verify both branches in
the diff.

## Example before/after

Before:
```tsx
<View style={{ backgroundColor: 'rgba(26,26,26,0.4)', borderColor: 'rgba(255,255,255,0.08)' }}>
  <Text style={{ color: 'white' }}>Title</Text>
</View>
```

After:
```tsx
const theme = useTheme()
// …
<View style={{ backgroundColor: theme.surface.glass, borderColor: theme.surface.border }}>
  <Text style={{ color: theme.text.primary }}>Title</Text>
</View>
```

## Back-compat during migration

`@/lib/shared/design` still re-exports `GLASS`, `SEMANTIC`, and `TEXT_OPACITY`
sourced from `darkTheme`. Non-migrated components continue to render
identically in the dark theme. These re-exports are deprecated — migrate them
when touching the component for other reasons. Once everything consumes
`useTheme()`, the re-exports can be deleted.

## Out of scope for the current foundation

- A real `light.ts` — we haven't yet designed a light theme. Adding one requires
  new value decisions (contrast, glass tint, shadow behavior) that belong with
  the design refresh, not with this plumbing work.
- System-preference auto-switching (`useColorScheme`).
- NativeWind / `tailwind.config` — its strings still resolve via back-compat
  re-exports; converting to CSS variables is separate work.
