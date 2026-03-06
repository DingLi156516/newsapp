# Feature & Phase Tracker

Single source of truth for PRD implementation status. See `PRD_Axiom_News.md` for full specifications.

---

## Phase Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — UI Scaffolding | ✅ Complete | All components, pages, static sample data |
| 2 — Data Layer | ✅ Complete | Supabase DB, RSS ingestion, Gemini AI, real article pipeline |
| 3 — Story Timeline | ⏳ Partial | Timeline, blindspot algo, AI summaries done; offline bookmarks, notifications, browser extension remaining |
| 4 — User Features | ⏳ Partial | Auth, dashboard, topic feeds, For You done; digest email, Stripe, region classification, mobile app remaining |
| 5 — Personalisation | ✅ Complete | Bookmarks, reading history, preferences, bias dashboard, suggestions |
| 6 — For You Feed | ✅ Complete | Personalized ranking, For You API, feed tab integration |

---

## Completed Features

| ID | Feature | PRD Ref |
|----|---------|---------|
| F-01 | Nexus Story Clustering | §2 F-01 |
| F-02 | Bias & Factuality Engine (7-point bias, 5-level factuality, ownership) | §2 F-02 |
| F-03 | Monochrome Spectrum Bar | §2 F-03 |
| F-06 | Source Directory (browse, filter by bias/factuality/ownership) | §2 F-06 |
| F-07 | My News Bias Dashboard (bias profile, suggestions, blindspot detection) | §2 F-07 |
| F-08 | Topic Feeds — core (follow topics, "For You" personalized feed) | §2 F-08 |
| F-09 | Bookmarks & Reading History — core (save stories, reading history, "already read" filtering) | §2 F-09 |
| F-05 | Manual Review Gate (admin review queue for AI summaries before publishing) | §2 F-05 |
| F-10 | Full-Text Search + Advanced Filters (headline search, bias range, factuality, date range, perspective presets) | §2 F-10 |
| F-11 | Story Timeline (coverage evolution over time) | §2 F-11 |

---

## In Progress / Remaining

### High Priority — Core PRD Features

| ID | Item | PRD Ref | Status | What's Left |
|----|------|---------|--------|-------------|
| F-05 | Manual review gate for AI summaries | §2 F-05 | ✅ Complete | Admin review queue, approve/reject workflow, review stats dashboard |

### Medium Priority — Phase 3/4 Feature Gaps

| ID | Item | PRD Ref | Status | What's Left |
|----|------|---------|--------|-------------|
| F-04 | Weekly Blindspot digest email | §2 F-04, §5 Phase 4 | Not started | Blindspot feed page exists; email digest not implemented |
| F-08 | Content-based region classification | §2 F-08, §5 Phase 4 | Not started | Gemini classifies story region during assembly; `stories.region` column; UI region filter |
| F-09 | Offline bookmarks / PWA cache | §2 F-09, §5 Phase 3 | Not started | Service worker, cache API for saved stories |
| F-12 | Notifications | §2 F-12, §5 Phase 3 | Not started | Breaking alerts, daily briefing, weekly blindspot report, bookmark update alerts |

### Lower Priority — Platform Expansion

| Item | PRD Ref | Status | What's Left |
|------|---------|--------|-------------|
| Browser extension (Chrome/Firefox) | §5 Phase 3 | Not started | Full extension for in-browser bias overlay |
| Stripe subscription tiers (Free/Pro/Premium) | §5 Phase 4 | Not started | Payment integration, tier-gated features |
| React Native mobile app (iOS + Android) | §5 Phase 4 | Not started | Mobile app with push notifications |

---

## Phase Deliverable Status

### Phase 1 — UI Scaffolding & Liquid Glass Component Library

- [x] Next.js 15 project scaffolded with Tailwind + Framer Motion
- [x] All 15 UI components built and rendered
- [x] Home feed page: NexusCards with FeedTabs, TopicPills, SearchFilters, SearchBar
- [x] Story detail page: AI summary tabs, SourceList, full SpectrumBar
- [x] Source directory page (static)
- [x] Blindspot feed page (filtered view)
- [x] Responsive: mobile-first, tested at 375px and 1440px

### Phase 2 — RSS Ingestion & Vector Clustering Engine

- [x] RSS feed parser for 50+ initial sources
- [x] Gemini 1.5 Flash embedding pipeline (pgvector storage)
- [x] Story clustering job (cosine similarity > 0.85)
- [x] Supabase schema: sources, articles, stories, embeddings tables
- [x] API routes in Next.js for feed, story detail, source directory
- [x] Bias/factuality seed data for all initial sources

### Phase 3 — Bias Visualization & Blindspot Algorithm

- [x] Spectrum distribution calculation per story (live data)
- [x] Blindspot detection algorithm (>80% one-side threshold)
- [x] Cross-spectrum AI summary generation (Gemini, 3 perspectives)
- [x] Story timeline feature
- [ ] Offline bookmarks (PWA cache)
- [ ] Push notifications (web + mobile)
- [ ] Browser extension (Chrome/Firefox)

### Phase 4 — User Dashboard & Personal Bias Analytics

- [x] Supabase Auth (email + Google OAuth)
- [x] My News Bias dashboard
- [x] Custom topic feeds + personalized "For You" tab
- [ ] Weekly Blindspot digest email
- [ ] Subscription tiers (Free / Pro / Premium) via Stripe
- [ ] Content-based region classification (AI-classified during story assembly)
- [ ] React Native mobile app (iOS + Android)

### Phase 5 — Personalisation (added post-PRD)

- [x] Bookmarks (save/remove stories)
- [x] Reading history (track/filter read stories)
- [x] User preferences (topics, notifications settings)
- [x] Bias calibration dashboard with suggestions
- [x] Settings page

### Phase 6 — For You Feed (added post-PRD)

- [x] Personalized ranking (topic match, blindspot boost, recency, unread bonus)
- [x] For You API endpoint
- [x] For You hook and feed tab integration
