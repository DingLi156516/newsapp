# Plan: Documentation Updates for Unified Bias Filter

## Context

The unified bias filter implementation is complete — PerspectiveSlider was removed from the codebase, perspective presets were added to SearchFilters, and `perspective` was removed from the API/validation layers. All 528 tests pass, build is clean, coverage is 88%.

However, **documentation was not updated** to reflect these changes. Multiple docs still reference the deleted PerspectiveSlider component, the removed `perspective` API parameter, and the now-unused `perspective-highlight` layoutId.

## Files to Update

### 1. `docs/components.md`
- **Line 30:** Remove `PerspectiveSlider` row from organisms table
- **Line 43:** Update `StickyFilterBar` description from "FeedTabs + PerspectiveSlider" → "FeedTabs (view-mode controls, always visible)"
- **Line 34:** Update `SearchFilters` description to mention perspective presets

### 2. `docs/architecture.md`
- **Line 117:** Home feed page description — remove "perspective slider", add "perspective presets"
- **Line 125:** Settings page — keep "perspective" mention (still in preferences DB, just drives biasRange now)
- **Line 132:** Remove PerspectiveSlider from Key UI components list
- **Line 263:** Remove `perspective` from GET /api/stories query params

### 3. `docs/design-system.md`
- **Line 18:** Remove `perspective-highlight` from layoutId list (no longer used)

### 4. `docs/operations.md`
- **Line 173:** Remove `perspective` row from /api/stories query parameters table

### 5. `docs/types.md`
- **Line 14:** Add `PERSPECTIVE_BIASES` to label/class maps line

### 6. `CLAUDE.md`
- **Line 55:** Remove `perspective-highlight` from Framer Motion layoutId list

### 7. `AGENTS.md`
- **Line 55:** Remove `perspective-highlight` from Framer Motion layoutId list

### 8. `README.md`
- **Line 127:** Remove `PerspectiveSlider.tsx` from project structure tree, add `SearchFilters.tsx` if missing
- **Line 248:** Remove `perspective-highlight` from Motion layout IDs

### 9. `TRACKER.md`
- **Line 69:** Update "PerspectiveSlider" → "SearchFilters" in Phase 1 checklist

### 10. `PRD_Axiom_News.md`
- **Line 170:** Update PerspectiveSlider mention (low priority — historical PRD doc)

### 11. Memory update
- Update `MEMORY.md` component structure to remove PerspectiveSlider, add SearchFilters

## Out of Scope (no changes needed)
- `Axiom-News-UI:UX-Engine.md` — original design spec, historical reference, leave as-is
- `docs/testing.md` — no perspective references found
- `lib/types.ts` — `PerspectiveFilter` type is still used (preferences DB + PERSPECTIVE_BIASES mapping), keep it

## Verification
1. `grep -r "PerspectiveSlider" docs/ CLAUDE.md AGENTS.md README.md TRACKER.md` — should return 0 results
2. `grep -r "perspective-highlight" docs/ CLAUDE.md AGENTS.md README.md` — should return 0 results
3. `grep "perspective" docs/operations.md docs/architecture.md` — should only reference `default_perspective` (DB column), not API param
4. `npm run build` — still clean
