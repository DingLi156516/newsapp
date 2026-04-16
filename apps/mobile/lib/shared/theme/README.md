# Mobile Theme Module

Runtime-switchable theme tokens for the Expo app. Components consume colors
via `useTheme()` instead of hardcoding `rgba()` / hex strings, which lets the
**dark** and **paper** themes coexist without per-component conditionals.

## Themes

| Name    | Aesthetic                       | Status bar | Blur tint |
| ------- | ------------------------------- | ---------- | --------- |
| `dark`  | Default — dark surfaces, white text | `light`    | `dark`    |
| `paper` | Sepia parchment + ink-brown text + grain overlay | `dark`     | `light`   |

The user picks via Settings → Appearance; the choice persists to AsyncStorage
under the key `axiom.theme` and rehydrates on launch (the layout gates render
on `useThemeHydrated()` to avoid first-paint flicker).

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

## Modal screens and the paper texture

The `<PaperTextureOverlay />` mounted in `app/_layout.tsx` paints over the root
Stack — but iOS `presentation: 'modal'` screens (`(auth)`) render in a
**separate native view hierarchy** that the root overlay does not cover. Each
modal screen must mount its own `<PaperTextureOverlay />` as the **last child**
of its `SafeAreaView` so the grain paints above the modal content (matching
the root shell's z-order):

```tsx
return (
  <SafeAreaView style={{ backgroundColor: theme.surface.background }}>
    {/* … modal content … */}
    <PaperTextureOverlay /> {/* MUST be last */}
  </SafeAreaView>
)
```

`PaperTextureOverlay` is pointer-transparent (`pointerEvents: 'none'` in style)
and renders nothing when `theme.texture.kind !== 'grain'`, so it doesn't block
buttons and there's no cost on the dark theme.

## The grain asset

`apps/mobile/assets/images/paper-grain.png` is a 100×100 grayscale+alpha PNG
(~9 KB) generated by a deterministic-PRNG noise script — committed directly
rather than regenerated on each build. If the texture ever needs to change,
re-run the generator (kept out of the repo on purpose) with the same seed for
reproducibility.

## Out of scope

- System-preference auto-switching (`useColorScheme`). Paper is a **style**
  choice, not a brightness signal.
- NativeWind / `tailwind.config` — its strings still resolve via back-compat
  re-exports; converting to CSS variables is separate work.
- Splash screen theming. Expo can't theme splash at runtime, so cold-starts
  with paper persisted will still flash the dark splash before the app
  hydrates.
