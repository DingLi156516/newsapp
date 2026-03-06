# PRD: Axiom News (Project Obsidian)
**Version:** 2.0
**Reference:** Ground.news feature parity + improvements
**Design Aesthetic:** Liquid Glass Monochrome (2026)

---

## 1. Executive Summary

Axiom News is a high-fidelity news aggregator designed to dismantle echo chambers through data visualization. It provides Ground News-equivalent functionality — story clustering, bias tracking, factuality ratings, blindspot detection, and cross-spectrum AI summaries — delivered through a minimalist, high-luxury, monochrome interface.

---

## 2. Core Features

### F-01: Nexus Story Clustering
- Aggregates articles from 500+ global sources via RSS + APIs
- Uses vector embeddings (pgvector) to group articles with >0.85 similarity into a single "Nexus Card"
- Each Nexus Card shows a neutral, AI-generated headline regardless of source framing
- Displays total source count: "43 sources covered this"
- Updates continuously; stories sorted by recency or coverage volume

### F-02: Bias & Factuality Engine

**Bias Rating (7-Point Scale):**
| Label | Pattern (Monochrome) | Description |
|---|---|---|
| Far Left | Dense 45° stripes (tight) | Clear systematic left bias |
| Left | Medium 45° stripes | Consistent left-leaning |
| Lean Left | Sparse dots | Slightly left of center |
| Center | Solid mid-grey #6B6B6B | No discernible political lean |
| Lean Right | Horizontal dashes | Slightly right of center |
| Right | Solid dark grey #2A2A2A | Consistent right-leaning |
| Far Right | Solid near-black #111111 | Clear systematic right bias |

Ratings are averaged from three third-party organizations:
- AllSides
- Ad Fontes Media
- Media Bias/Fact Check

**Factuality Rating (5-Level):**
| Level | Dots | Meaning |
|---|---|---|
| Very High | ●●●●● | Well-researched, reliable, corrections issued promptly |
| High | ●●●●○ | Mostly accurate, balanced |
| Mixed | ●●●○○ | Blend of fact and opinion, some failed fact-checks |
| Low | ●●○○○ | Significant inaccuracies, poor sourcing |
| Very Low | ●○○○○ | Sensational, unreliable |

Ratings aggregated from Ad Fontes Media + Media Bias/Fact Check.

**Ownership Transparency (8 Categories):**
Independent | Corporate Conglomerate | Private Equity | State-Funded | Telecom | Government | Non-Profit | Other

### F-03: Monochrome Spectrum Bar
- A horizontal 7-segment bar on every Nexus Card
- Each segment's width = percentage of that bias category's sources covering the story
- E.g., if 35% of covering sources are Left-leaning, the Left segment occupies 35% of bar width
- A floating legend icon (ⓘ) reveals the pattern → bias mapping

### F-04: The Blindspot Feed
- Identifies stories where coverage ratio is >80% from one side of the spectrum
- Dedicated /blindspot feed page
- "Blindspot" badge on qualifying Nexus Cards in the main feed
- Weekly Blindspot digest (Phase 4)

### F-05: Cross-Spectrum AI Summaries
Every story detail view provides three perspectives:
1. **Common Ground** — facts agreed upon across all sources
2. **Left Framing** — unique rhetoric/focus from left-leaning outlets
3. **Right Framing** — unique rhetoric/focus from right-leaning outlets

AI uses only High or Very High factuality sources as input. Manual review gate before publishing.

### F-06: Source Directory
- Browse all 500+ sources with bias, factuality, and ownership ratings
- Filterable by bias category, factuality level, ownership type
- Each source page shows: rating breakdown, sample stories, rating methodology

### F-07: My News Bias Dashboard (Phase 4)
- Personal reading analytics: shows user's bias distribution, factuality average, and ownership breakdown
- Displays personal blindspots (which bias category the user underreads)
- Privacy-preserving: analytics stored locally, not shared

### F-08: Topic Feeds
- Follow topics: Politics, World, Technology, Business, Science, Health, Culture, Sports, Environment
- Personalized "For You" feed based on followed topics + reading behavior
- Regional editions (future): content-based region classification via Gemini during story assembly. Classifies what geographic area the story covers (not source origin). Regions: US, Europe, UK, Asia-Pacific, Middle East, Africa, Global. Stored on `stories.region`. UI region filter returns once AI-classified regions are populated.

### F-09: Bookmarks & Reading History
- Save any story with one tap
- Saved stories available offline (Phase 3)
- Reading history for "already read" filtering

### F-10: Search
- Full-text search across all clustered stories
- Filter by topic, bias range, factuality, date range
- Results show matching Nexus Cards with spectrum bars

### F-11: Story Timeline (Phase 3)
- For major ongoing stories, view how coverage evolved over days/weeks
- Timeline of new source additions, shifts in framing, factuality changes

### F-12: Notifications (Phase 3)
- Breaking news alerts
- Daily briefing (user-configured time)
- Weekly Blindspot report
- Story updates for bookmarked articles

---

## 3. UI/UX Specification

### 3.1 Visual Language

**Color Palette:**
- Background: `#000000` (Pure Black) to `#0A0A0A` (Obsidian)
- Surfaces: `rgba(26, 26, 26, 0.4)` with `backdrop-blur: 20px`
- Borders: `0.5px solid rgba(255, 255, 255, 0.08)` ("Silk" borders)
- Text Primary: `#FFFFFF`
- Text Secondary: `rgba(255, 255, 255, 0.5)`
- Text Tertiary: `rgba(255, 255, 255, 0.3)`
- Accent: `rgba(255, 255, 255, 0.12)` (hover states)

**Typography:**
- Headlines: `DM Serif Display` — bold, editorial, authoritative
- Body / UI: `Inter` — clean, high-readability sans-serif
- Metadata: `Inter` at `0.75rem`, weight 400, secondary color

**Geometry:**
- Container radius: `24px`
- Badge/pill radius: `999px` (fully rounded)
- Inner card elements: `12px`

**Motion (Framer Motion):**
- All transitions: `type: "spring", stiffness: 300, damping: 30`
- Cards: `whileHover={{ scale: 1.01 }}` with `0.2s` ease
- Tab/slider active pill: `layoutId` shared across tabs for liquid flow

### 3.2 Component Spec

See Axiom-News-UI:UX-Engine.md for full component specifications.

---

## 4. Technical Architecture

| Layer | Technology |
|---|---|
| Web Frontend | Next.js 15 (App Router) |
| Mobile | React Native (Phase 2+) |
| Styling | Tailwind CSS + Framer Motion |
| Icons | Lucide React |
| Auth | Supabase Auth |
| Database | Supabase Postgres + pgvector |
| AI Clustering | Gemini 1.5 Flash (embeddings + summaries) |
| RSS Ingestion | Custom Node.js worker (Phase 2) |
| Hosting | Vercel (web) + Railway (workers) |

---

## 5. Implementation Phases

### Phase 1: UI Scaffolding & Liquid Glass Component Library
**Goal:** Pixel-perfect UI with hardcoded sample data. No backend.

Deliverables:
- Next.js 15 project scaffolded with Tailwind + Framer Motion
- All 15 UI components built and rendered
- Home feed page: NexusCards with FeedTabs, TopicPills, PerspectiveSlider, SearchBar
- Story detail page: AI summary tabs, SourceList, full SpectrumBar
- Source directory page (static)
- Blindspot feed page (filtered view)
- Responsive: mobile-first, tested at 375px and 1440px

### Phase 2: RSS Ingestion & Vector Clustering Engine
**Goal:** Real data flowing into the UI.

Deliverables:
- RSS feed parser for 50+ initial sources
- Gemini 1.5 Flash embedding pipeline (pgvector storage)
- Story clustering job (cosine similarity > 0.85)
- Supabase schema: sources, articles, stories, embeddings tables
- API routes in Next.js for feed, story detail, source directory
- Bias/factuality seed data for all initial sources

### Phase 3: Bias Visualization & Blindspot Algorithm
**Goal:** The core value proposition working end-to-end.

Deliverables:
- Spectrum distribution calculation per story (live data)
- Blindspot detection algorithm (>80% one-side threshold)
- Cross-spectrum AI summary generation (Gemini, 3 perspectives)
- Story timeline feature
- Offline bookmarks (PWA cache)
- Push notifications (web + mobile)
- Browser extension (Chrome/Firefox)

### Phase 4: User Dashboard & Personal Bias Analytics
**Goal:** Personalization and retention features.

Deliverables:
- Supabase Auth (email + Google OAuth)
- My News Bias dashboard
- Custom topic feeds + personalized "For You" tab
- Weekly Blindspot digest email
- Subscription tiers (Free / Pro / Premium) via Stripe
- Content-based region classification (AI-classified during story assembly, see F-08)
- React Native mobile app (iOS + Android)
