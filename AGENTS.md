# Axiom News — Project Guide

**Project Obsidian / Axiom News** — Next.js news aggregation app surfacing political bias, factuality, and coverage distribution. Through Phase 7: personalization, blindspot digest email (Resend), region classification, and offline PWA.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v3 + custom plugin, Framer Motion v11 |
| Data | Supabase (PostgreSQL), SWR v2, Zod v4, Resend (email) |
| AI/RSS | Google Gemini (REST), rss-parser |
| Auth | Supabase Auth (@supabase/ssr) |
| Testing | Vitest + @testing-library/react |

## Key Commands

```bash
npm run dev            # Dev server (localhost:3000)
npm run build          # Production build (zero errors required)
npm run lint           # ESLint
npm test               # All tests
npm run test:coverage  # Coverage (target ≥80%)
npm run test:e2e       # Playwright E2E tests
```

## Reference Docs

| File | Contents |
|------|----------|
| `docs/components.md` | Component inventory — atoms, molecules, organisms with imports |
| `docs/design-system.md` | Glass utilities, spectrum CSS, animations, typography |
| `docs/architecture.md` | Import conventions, client components, backend modules, API routes |
| `docs/testing.md` | Vitest framework, mocks, test file locations, coverage target |
| `docs/types.md` | TypeScript types, label/class maps, sample data, DB schema types |
| `docs/pipeline.md` | Pipeline architecture — stages, process runner loop, claims, concurrency |
| `docs/operations.md` | Operational runbook — pipeline, curl commands, env vars, reprocessing |
| `docs/mobile-architecture.md` | Mobile app screens, navigation, hooks, auth flow, API integration |
| `docs/mobile-components.md` | Mobile component inventory — atoms, molecules, organisms with props |
| `docs/mobile-testing.md` | Mobile Jest + Maestro E2E setup, test files, testID conventions |
| `TRACKER.md` | Feature & phase implementation status tracker |

## Critical Rules (always in context)

### Imports
- **Always** use `@/` for project-relative imports — never `../` or `./` cross-directory

### Immutability
- **Never** mutate state — always create new objects/arrays

### Next.js 15 Async Params
- Story detail uses `use(params)` — never access `params.id` directly

### CSS Classes
- Use `.glass`, `.glass-sm`, `.glass-pill` for frosted surfaces (never one-off `backdrop-blur`)
- Use `.spectrum-{bias}` classes from `BIAS_CSS_CLASS` in `@/lib/types`

### Framer Motion layoutId
- Each `layoutId` must be unique: `feed-tab-underline`, `topic-pill-highlight`, `ai-tab-underline`

### Integration Tests
- **Always** run `npm run test:e2e` after major/impactful changes (queries, API routes, middleware, data models, auth)

### Codex Auto-Review

When a session is about to end, evaluate whether the changes warrant external review via Codex.

**Trigger (any one):**
- Added or modified ≥3 business files (excluding tests, config, docs)
- Touched API routes, DB migrations, auth logic, or other critical paths
- Introduced new architectural patterns or significant refactoring

**Skip:**
- Pure docs, config, or test-only changes
- Single-file small bug fixes
- Conversational Q&A with no code changes

**How to invoke:**
Use `/codex:review` (standard review) or `/codex:adversarial-review` (challenges design decisions). Supports `--base <ref>` for branch diff and `--background` for async execution.

## Feature Development Workflow

When implementing a new feature, follow this standard product development lifecycle:

1. **Plan** — Use the planner agent to design the approach; identify files, dependencies, risks
2. **Schema & Types** — Add DB migrations, update `lib/supabase/types.ts`, add Zod validation schemas
3. **Tests First (TDD)** — Write unit tests before implementation (RED → GREEN → REFACTOR)
4. **Implement** — Backend (queries → API route) → Frontend (hook → component → page)
5. **E2E Tests** — Add Playwright tests for critical user flows when the feature involves new pages or user journeys
6. **Update Docs** — Update all relevant docs (`docs/*.md`, `CLAUDE.md`, `README.md`):
   - `docs/components.md` — new components
   - `docs/architecture.md` — new modules, hooks, API routes, pages, DB tables
   - `docs/testing.md` — new test files
   - `docs/operations.md` — new API endpoints
   - `docs/types.md` — new types
   - `README.md` — project structure tree
7. **Verify** — `npm test` + `npm run test:coverage` (≥80%) + `npm run test:e2e` + `npm run build` (zero errors)
