# Axiom News — UI/UX Engine
**Role:** Senior Frontend Engineer + UI Designer
**Goal:** Build the "Liquid Glass" component library for Axiom News

---

## 1. Visual Constraints (2026 Liquid Glass, Monochrome)

```
Backgrounds:    #000000 (Pure Black), #0A0A0A (Obsidian)
Glass surfaces: backdrop-blur: 20px + rgba(26,26,26,0.4) + silk border
Silk borders:   0.5px solid rgba(255,255,255,0.08)
Container radius: 24px  |  Pill radius: 999px  |  Inner: 12px
Fonts:          DM Serif Display (headlines) + Inter (UI/body)
Motion:         Framer Motion, spring(300, 30), layoutId for liquid tabs
```

---

## 2. Technical Stack

- **Framework:** Next.js 15 (App Router, React Server Components)
- **Styling:** Tailwind CSS (custom config) + raw CSS patterns for bias segments
- **Icons:** Lucide React
- **Animation:** Framer Motion
- **Types:** TypeScript strict mode

---

## 3. Tailwind Config Extensions

```typescript
// Custom utilities to add:
glass:         "backdrop-blur-[20px] bg-[rgba(26,26,26,0.4)] border border-[rgba(255,255,255,0.08)] rounded-[24px]"
glass-sm:      "backdrop-blur-[16px] bg-[rgba(26,26,26,0.5)] border border-[rgba(255,255,255,0.08)] rounded-[12px]"
glass-pill:    "backdrop-blur-[16px] bg-[rgba(26,26,26,0.6)] border border-[rgba(255,255,255,0.1)] rounded-full"
mesh-gradient: radial-gradient(ellipse at center, #0D0D0D 0%, #000000 100%)

// Spectrum pattern utilities (CSS backgroundImage):
spectrum-far-left:   repeating-linear-gradient(-45deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 2px, transparent 2px, transparent 6px)
spectrum-left:       repeating-linear-gradient(-45deg, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 2px, transparent 2px, transparent 10px)
spectrum-lean-left:  radial-gradient(circle, rgba(255,255,255,0.4) 1.5px, transparent 1.5px) [6px 6px]
spectrum-center:     solid #6B6B6B
spectrum-lean-right: repeating-linear-gradient(0deg, rgba(255,255,255,0.3) 0px, rgba(255,255,255,0.3) 2px, transparent 2px, transparent 8px)
spectrum-right:      solid #2A2A2A
spectrum-far-right:  solid #111111

// Font tokens:
fontFamily.serif:  ['DM Serif Display', 'Georgia', 'serif']
fontFamily.sans:   ['Inter', 'system-ui', 'sans-serif']
```

---

## 4. Component Specifications

### A. MonochromeSpectrumBar
```typescript
interface Props {
  segments: { bias: BiasCategory; percentage: number }[]
  showLegend?: boolean  // default false; show ⓘ tooltip trigger
  height?: 'sm' | 'md'  // sm=4px, md=8px, default md
}
```
- Renders a flex row of 7 segments
- Segment width = percentage% of bar
- Each segment background = its bias CSS pattern
- Zero-percentage segments: display: none
- showLegend=true: renders a floating ⓘ icon that opens BiasLegend tooltip

### B. BiasLegend
```typescript
// No props — standalone floating card
```
- Triggered by ⓘ button on SpectrumBar
- Shows: 7 rows of [pattern swatch] [label]
- position: absolute, glass-sm styling, z-50

### C. NexusCard
```typescript
interface Props {
  article: NewsArticle
  onSave: (id: string) => void
  isSaved: boolean
  onClick: () => void  // navigate to story detail
}
```
Layout (top-to-bottom inside glass card):
1. Background image (Next.js Image) at opacity-[0.06] absolute positioned
2. Top row: CoverageCount + optional BlindspotBadge + topic pill + BookmarkButton
3. Headline: DM Serif Display, text-2xl, font-bold, leading-tight
4. Bottom row: FactualityDots + factuality label + ownership icon
5. MonochromeSpectrumBar at very bottom (full width, md height)

Framer Motion: whileHover={{ scale: 1.01 }}, whileTap={{ scale: 0.99 }}

### D. FactualityDots
```typescript
interface Props {
  level: 'very-high' | 'high' | 'mixed' | 'low' | 'very-low'
}
```
- 5 dots in a row
- Filled dot: rgba(255,255,255,0.8) circle
- Empty dot: rgba(255,255,255,0.2) circle outline
- Mapping: very-high=5, high=4, mixed=3, low=2, very-low=1

### E. CoverageCount
```typescript
interface Props { count: number }
```
- Renders: "43 sources" in glass-pill styling
- Icon: Lucide Newspaper at 12px

### F. BlindspotBadge
- No props — renders when article.isBlindspot === true
- Text: "BLINDSPOT"
- Background: spectrum-far-left CSS pattern
- Border: silk border, rounded-full

### G. BookmarkButton
```typescript
interface Props {
  isSaved: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
}
```
- Lucide Bookmark icon
- Framer Motion: animate={{ fill: isSaved ? 'white' : 'transparent' }}
- whileTap={{ scale: 0.8 }}

### H. BiasTag
```typescript
interface Props { bias: BiasCategory; label?: boolean }
```
- Small pill with appropriate CSS pattern background
- Optional text label (e.g., "Lean Left")
- Used in SourceList rows

### I. SourceList
```typescript
interface Props {
  sources: NewsSource[]
  defaultExpanded?: boolean
  maxVisible?: number  // show N, then "Show more"
}
```
- Collapsible section with Framer Motion height animation
- Each row: [BiasTag] [FactualityDots] Source Name [Ownership icon]
- Max 5 visible by default, "Show X more" expander
- Header: "Sources (43) ▾" with animated chevron

### J. PerspectiveSlider
```typescript
interface Props {
  value: PerspectiveFilter
  onChange: (v: PerspectiveFilter) => void
}
```
Options: All | Left | Center | Right
- Horizontal pill group with layoutId="perspective-highlight" glass pill
- Framer Motion spring transition between positions
- role="tablist", each option role="tab", aria-selected

### K. FeedTabs
```typescript
interface Props {
  value: 'trending' | 'latest' | 'blindspot' | 'saved'
  onChange: (v: string) => void
  savedCount?: number
}
```
- Same liquid pill animation as PerspectiveSlider
- Tabs: Trending | Latest | Blindspot | Saved (N)
- Blindspot tab shows count badge if > 0 blindspot stories

### L. TopicPills
```typescript
interface Props {
  selected: Topic | null
  onChange: (t: Topic | null) => void
}
```
- Horizontal scrollable row, no scrollbar visible
- Pills: All | Politics | World | Technology | Business | Science | Health | Culture
- Active pill: glass-pill + white text; inactive: transparent + dim text

### M. SearchBar
```typescript
interface Props {
  value: string
  onChange: (v: string) => void
  onClear: () => void
}
```
- Full-width input, glass styling
- Lucide Search icon on left, X clear button on right (appears when value.length > 0)
- Focus state: border-[rgba(255,255,255,0.2)] (slightly brighter silk border)
- Inter font, text-sm

### N. AISummaryTabs
```typescript
interface Props {
  commonGround: string
  leftFraming: string
  rightFraming: string
}
```
- 3 tabs: Common Ground | Left ↗ | Right ↗
- Active tab: glass underline, text primary
- Content: bullet-pointed prose, Inter, text-sm, secondary text color
- Framer Motion AnimatePresence for tab content swap

### O. RegionSelector
```typescript
interface Props {
  value: 'us' | 'international' | 'uk' | 'canada' | 'europe'
  onChange: (v: string) => void
}
```
- Compact dropdown, glass-sm styling, Lucide Globe icon

---

## 5. Page Layouts

### Home Page (app/page.tsx)
```
<header>
  <SearchBar />          <RegionSelector />
</header>
<TopicPills />
<FeedTabs />
<PerspectiveSlider />
<main>
  {filtered articles.map(a => <NexusCard />)}
</main>
```

### Story Detail Page (app/story/[id]/page.tsx)
```
<BackButton />           <BookmarkButton />
<BlindspotBadge />  <CoverageCount />  <TopicPill />
<h1>{headline}</h1>
<MonochromeSpectrumBar showLegend />
<AISummaryTabs />
<SourceList sources={article.sources} />
```

### Source Directory Page (app/sources/page.tsx)
```
<SearchBar />
<BiasFilter /> (7 toggles)  <FactualityFilter /> (5 toggles)
<SourceGrid>
  {sources.map(s => <SourceCard />)}
</SourceGrid>
```

### Blindspot Page (app/blindspot/page.tsx)
- Same as Home feed but pre-filtered to isBlindspot === true
- Header banner explaining what Blindspot means

---

## 6. Accessibility & Performance

- All interactive elements: keyboard navigable, focus-visible ring (ring-1 ring-white/20)
- All images: alt text required
- AISummaryTabs: role="tabpanel", aria-labelledby
- Color is NEVER the sole differentiator — patterns always paired with labels
- React Server Components for all static/feed content
- Client Components only where state/interaction is needed
- next/image with blur placeholder on all article images
- Skeleton loading states for all async data (Phase 2+)

---

## 7. Execution Order

1. Scaffold Next.js 15 project
2. Configure tailwind.config.ts + globals.css
3. Write lib/types.ts + lib/sample-data.ts
4. Build atoms: FactualityDots, BiasTag, CoverageCount, BlindspotBadge, BookmarkButton
5. Build molecules: MonochromeSpectrumBar, BiasLegend, SourceList
6. Build organisms: NexusCard, PerspectiveSlider, FeedTabs, TopicPills, SearchBar, AISummaryTabs, RegionSelector
7. Build pages: app/layout.tsx, app/page.tsx, app/story/[id]/page.tsx, app/sources/page.tsx, app/blindspot/page.tsx
8. Run npm run build — verify zero errors
