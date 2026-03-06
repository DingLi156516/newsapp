# Design System Rules

## Glass Utilities

- **Always** use `.glass`, `.glass-sm`, or `.glass-pill` for frosted-glass surfaces
- **Never** write one-off `backdrop-blur` classes — use the utility classes
- Defined in `tailwind.config.ts` plugin and `globals.css`

## Spectrum / Bias CSS

- **Always** use `.spectrum-{far-left,left,lean-left,center,lean-right,right,far-right}` CSS classes
- These come from `BIAS_CSS_CLASS` record in `@/lib/types`
- Pattern renders as a repeating diagonal stripe texture per bias category

## Liquid Tab Animations

- **Always** use `layoutId` for animated tab underlines / pill highlights
- Defined IDs in use: `feed-tab-underline`, `topic-pill-highlight`, `ai-tab-underline`
- Never duplicate a `layoutId` — each must be unique per Framer Motion context

## Typography

- Headlines: `DM Serif Display` (Google Font, loaded in `app/globals.css`)
- Body/UI: `Inter` (system-ui fallback)
- Tailwind font-serif targets DM Serif Display via `tailwind.config.ts`
