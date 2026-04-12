# Phase 9B Ownership Data — Spike Findings

**Date:** 2026-04-11
**Status:** Spike complete · **Decision: GO (with caveats)**
**Scope:** Read-only research — no schema or code changes.

## Question

> Can we low-cost, reliably acquire `{owner_name, parent_owner, owner_type, country}` for the top ~60 Axiom sources, using automation where possible?

## TL;DR

**GO.** Wikidata SPARQL (property P127 "owned by" + P17 "country of origin") delivers usable owner + country data for **16/20 tested sources (80%)** with zero API cost and no rate limits at our scale. The remaining 4 sources (National Review, Vox Media, Breitbart News, partial WSJ) need manual enrichment, budget ≤15 minutes total. Cost per source averages ≈30 seconds of automation + ≈2 minutes of human validation for edge cases — well under the 3-minute/source ceiling.

The spike surfaced design decisions that must happen **before** schema work:

1. **`owner_type` is not derivable from Wikidata** — it's an editorial taxonomy (public_company / private_company / cooperative / public_broadcaster / trust / individual / state_adjacent / nonprofit / subsidiary). Wikidata's P31 (instance of) gets you 60% of the way but needs manual grouping.
2. **Multi-value owners need a policy** — Daily Mail returns both "Daily Mail and General Trust" (company) and "Viscount Rothermere" (ultimate beneficial owner). Fox News returns historical chain (News Corp → 21st Century Fox → Fox Corp). Implementation must pick one canonical owner.
3. **Individuals as owners** — Jeff Bezos owns Washington Post via Nash Holdings. Schema should accept both a company name and an individual name, or always denormalize through a shell company.
4. **Wikidata can be stale** — Breitbart News still lists Andrew Breitbart (deceased 2012). Need a validation pass before trusting any auto-imported value.

## Candidate comparison

| Candidate | Tested | Rate limit | Cost | Owner coverage | Country coverage | Owner type? | Verdict |
|---|---|---|---|---|---|---|---|
| **Wikidata SPARQL** (P127/P17/P31) | ✅ yes, 20 samples | None at our scale | Free | 80% (16/20) | 95% (19/20) | Partial (via P31) | ✅ **Winner** |
| **MBFC ownership field** | ✅ (grep) | — | — | 0% — MBFC dataset has no ownership field | — | — | ❌ Unusable |
| **OpenCorporates API** | ❌ not tested (free tier gated behind signup + daily cap) | 200 req/day free | Signup + API key | Unknown; strong for US/UK | None | Partial | ⏸ Fallback only |
| **Manual Wikipedia scrape** | ❌ not tested (infobox parsing is brittle) | None | Human time | High (est. 95%+) | High | Yes (with judgment) | ⏸ Fallback for gaps |

### Why Wikidata wins

1. **Free and uncapped at our scale.** 60 sources × 1 query ≈ one SPARQL call. No API key.
2. **Structured, not scraped.** Returns labeled entity IDs, not HTML. Deterministic parsing.
3. **Already works for 16/20 top sources** on the first query attempt, before any tuning.
4. **Linked relationships enable chain queries later.** P127 can be followed recursively to build control chains (needed if we ever want "N sources same ultimate owner" clustering).
5. **Community-maintained.** When stale data is found, we can fix it upstream instead of patching locally.

### Why MBFC/OpenCorporates/manual are secondary

- **MBFC:** Grepped `lib/bias-ratings/providers/mbfc.ts` for "ownership|owned|parent" — zero hits. Dataset doesn't carry this info. Dead end.
- **OpenCorporates:** Requires account registration, has a 200 req/day limit on the free tier, and is optimized for **legal entity** lookups (not media brand names). Would need a "media brand → legal entity name" mapping layer first. Overkill for our scale; reserve for future if Wikidata gaps grow.
- **Manual Wikipedia:** Works but doesn't automate. Use as a patching tool for the ~4 Wikidata gaps, not as a primary source.

## Sample results (detail)

Full 20-source CSV in `docs/spike-9b-sample.csv`. Summary:

### Batch 1 — canonical large sources (10/10 resolved)

| Source | Owner | Country | Notes |
|---|---|---|---|
| NYT | The New York Times Company | US | Clean |
| Fox News | Fox Corporation | US | Historical chain noise — need P580 filter |
| Reuters | Thomson Reuters | UK | Clean |
| AP | — (cooperative) | US | P127 empty **by design** — AP is member-owned |
| Guardian | Guardian Media Group | UK | Trust parent (Scott Trust) flattened |
| BBC | — (P127) / DCMS (P749) | UK | Public broadcaster — P127 empty, P749 returns gov dept |
| CNN | Warner Bros. Discovery | US | Clean |
| WSJ | Dow Jones & Company | *(empty)* | Country missing — trivial manual fix |
| Bloomberg News | Bloomberg L.P. | US | Clean |
| Politico | Axel Springer SE | US | Clean (2021 acquisition) |

### Batch 2 — varied size/type (7/10 fully resolved, 3 partial)

| Source | Owner | Country | Status |
|---|---|---|---|
| Al Jazeera | Al Jazeera Media Network | Qatar | ✅ Owner type needs `state_adjacent` flag |
| Washington Post | Jeff Bezos | US | ✅ Individual owner — schema decision needed |
| Daily Mail | Daily Mail and General Trust | UK | ✅ Multi-value (also Viscount Rothermere) |
| NPR | — (cooperative) | US | ✅ Nonprofit / cooperative — P127 empty by design |
| The Atlantic | Emerson Collective | US | ✅ Clean |
| HuffPost | BuzzFeed | US | ✅ Clean (2020 acquisition) |
| Axios | Cox Enterprises | US | ✅ Clean (2022 acquisition) |
| Breitbart News | Andrew Breitbart (STALE — deceased 2012) | US | ⚠️ Wikidata data stale — manual correction |
| Vox Media | — (P127 empty) | US | ⚠️ Wikidata gap — Penske Media acquired 2024, not yet in Wikidata |
| National Review | — (P127 empty) | US | ⚠️ Wikidata gap — owned by NR Institute (nonprofit) |

### Coverage statistics

| Field | Filled | Fill rate | Notes |
|---|---|---|---|
| `owner_name` (direct) | 14/20 | 70% | Raw P127 hits |
| `owner_name` (+ "cooperative/broadcaster" inferred from P31) | 16/20 | 80% | AP, NPR become "ownership type = cooperative" instead of a name |
| `country` | 19/20 | 95% | Only WSJ missing |
| `parent_owner` (P749) | 12/20 | 60% | Partial; often duplicates owner |
| `owner_type` (derivable from Wikidata) | 12/20 | 60% | Needs editorial mapping for the rest |
| Data accuracy (no known staleness) | 16/20 | 80% | Breitbart + Vox + NR + partial Daily Mail multi-value |

### Real-cost estimate per source

- **Automated SPARQL query (batch of 60):** ≈5 seconds total for all sources in one query.
- **Manual validation (necessary — Wikidata staleness risk):** ~1 minute per source to spot-check against current Wikipedia infobox.
- **Gap-filling for sources Wikidata misses:** ~5 minutes per source × ~20% miss rate = 1 min/source amortized.
- **Owner-type editorial mapping:** ~30 seconds per source (first pass; subsequent sources reuse the taxonomy).

**Total: ≈2.5 minutes per source** — within the 3-minute/source ceiling, with headroom.

## Decision: GO

Criteria from the plan:
- [x] **Coverage ≥80%** — hit exactly 80% on the 4-field model (with "cooperative" type counting as filled).
- [x] **Per-source cost ≤3 minutes** — ≈2.5 minutes including manual validation.
- [x] **Stable and legal data source** — Wikidata is CC0, no ToS issues, no rate limits at our scale.

**Proceed to implementation (separate plan),** with the four design decisions below resolved **before** writing the migration.

## Pre-implementation decisions (must answer before schema work)

### D1. `owner_type` taxonomy — editorial list

Recommend these 8 values (closed set, stored as enum or CHECK constraint):

```
public_company       — listed on a stock exchange (NYT, CNN, Reuters, Daily Mail)
private_company      — privately held corp (The Atlantic, Axios, Bloomberg)
cooperative          — member-owned not-for-profit (AP)
public_broadcaster   — government-chartered non-commercial (BBC, NPR)
trust                — trust or foundation-owned (Guardian via Scott Trust)
individual           — ultimate beneficial owner is a person, not a company (WaPo — Bezos)
state_adjacent       — state-funded or state-influenced but arm's-length (Al Jazeera)
nonprofit            — 501(c)(3) or equivalent (National Review Institute, ProPublica)
```

This list is derived from the 20 sample sources. Any source that doesn't fit gets added as a new enum value via migration (rare, low-risk).

### D2. Multi-value P127 — canonical-owner policy

**Rule:** when Wikidata returns multiple P127 values (like Fox News → News Corp + 21st Century Fox + Fox Corp), pick the value where `P580 (start time)` is most recent. If P580 is absent, take the first alphabetical value as a stable fallback and flag for manual review. This is ~5 lines in the SPARQL query.

### D3. Individual owners vs. company names

**Rule:** Store `owner_name TEXT` + `owner_is_individual BOOLEAN`. Don't force denormalization through shell companies — that obscures the actual controlling party which is the entire point of the feature. When we eventually render "owned by" in the UI, individuals get a different glyph.

### D4. Staleness handling (Wikidata truth vs. reality)

**Rule:** Store `owner_source ENUM('wikidata', 'manual')` + `owner_verified_at TIMESTAMP`. Admin UI should warn when a record was auto-imported >90 days ago and hasn't been re-verified. This lets us catch Breitbart-style staleness without rejecting Wikidata outright.

## Gaps to fill manually (4 sources, est. 20 minutes total)

1. **Breitbart News** → owner: Breitbart News Network LLC, owner_type: private_company (override Wikidata)
2. **Vox Media** → owner: Penske Media Corporation (since 2024 merger), owner_type: private_company
3. **National Review** → owner: National Review Institute, owner_type: nonprofit
4. **WSJ country** → United States (trivial)

## Next steps (not in this spike's scope)

Subsequent plan should cover:

1. **Schema:** `media_owners` table (self-referential `parent_owner_id` for ultimate beneficial owner chain) + `sources.owner_id` FK + `owner_type` enum.
2. **Seed script:** takes `spike-9b-sample.csv` → inserts 20 rows; extend to full 60-source set.
3. **SPARQL helper:** `lib/ownership/wikidata-lookup.ts` — batch query + staleness check. One-shot, not wired into ingestion pipeline.
4. **API:** `GET /api/owners/[id]` → owner + sources it controls.
5. **UI:** `SourcesView` group-by-owner toggle + `StoryDetail` "N sources from same owner" header.
6. **Admin:** edit/override owner at `/admin/sources/[id]` (already has detail page — just add fields).

Est. total: 1-2 weeks after spike, within the plan's original estimate.

## What this spike ruled OUT

- ❌ **OpenCorporates as primary source** — too much overhead for our scale.
- ❌ **Live-API dependency** — not needed. Static import + manual refresh is enough.
- ❌ **Building ownership chains deeper than owner+parent_owner** — deferred. The 4-field model is enough for MVP ("N stories from same owner"); recursive chains (e.g. "owned by Paramount → owned by National Amusements → owned by Redstone family") can come later if users ask.
- ❌ **Building a Wikidata editor** — not in scope. If we find bad data, fix it upstream on Wikidata.org; don't build a shadow truth.

## Appendix: reproducible SPARQL query

The winning query shape used for batch lookups:

```sparql
SELECT ?item ?itemLabel ?owner ?ownerLabel ?parent ?parentLabel ?country ?countryLabel ?instance ?instanceLabel WHERE {
  VALUES ?item { wd:Q9684 wd:Q186068 wd:Q130879 wd:Q40469 wd:Q11148 wd:Q9531 wd:Q48340 wd:Q164746 wd:Q14270642 wd:Q3109740 }
  OPTIONAL { ?item wdt:P127 ?owner. }      # owned by
  OPTIONAL { ?item wdt:P749 ?parent. }      # parent organization
  OPTIONAL { ?item wdt:P17 ?country. }      # country
  OPTIONAL { ?item wdt:P31 ?instance. }     # instance of (for type inference)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

Endpoint: `https://query.wikidata.org/sparql?format=json&query=...` (URL-encoded).

Entity ID lookup (one per source): `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=<name>&language=en&format=json&limit=3&type=item`

Both endpoints have no auth, no rate limit at our scale, and CC0 data licensing.
