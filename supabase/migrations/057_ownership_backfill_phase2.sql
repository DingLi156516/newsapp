-- Migration 057: ownership backfill phase 2 + restore NULLed QIDs from 056.
--
-- Context. Migration 056 shipped 18 hand-authored owners (coverage 20 → 38 of
-- 54 active sources) and NULLed two QIDs from 055 that had resolved to
-- unrelated Wikidata entities (Q473677 = Cistercians; Q1165602 = VIVAQUA).
-- Migration 057 builds on top of 056 in two parts:
--
--   Part A: Restore correct QIDs for the-daily-beast and the-epoch-times so
--           the seed-ownership.ts dry-run will treat them as `confirmed`
--           (already linked via 056) instead of `skip` (no QID).
--   Part B: Insert 5 new owners covering remaining unlinked outlets where
--           ownership *and* Wikidata QID are both verifiable; link the
--           matching sources. Coverage moves 38 → 43 of 54 active sources.
--
-- All new owners use owner_source = 'manual' with a verified QID. We
-- deliberately do NOT insert owner rows with wikidata_qid = NULL: the
-- downstream seed-ownership.ts decideAction() can't compare a null QID
-- against a resolved Wikidata owner, so linked-without-QID rows would
-- surface as a permanent `mismatch` on every future dry-run (workflow
-- hazard flagged by Codex adversarial-review). Outlets whose ownership
-- is known but whose QID we haven't yet verified (daily-wire, the-blaze,
-- the-american-prospect) are deferred to a future migration once an
-- operator runs the extended dry-run and supplies the QID.
--
-- Deferred to a future 059+ after operator Wikidata verification (the
-- extended seed-ownership.ts with P749/P123 coverage in Commit 1 will
-- surface these as `insert` candidates with medium/low confidence):
--   daily-wire            — The Daily Wire LLC, QID unverified
--   the-blaze             — Blaze Media, QID unverified
--   the-american-prospect — American Prospect, Inc., QID unverified
--   jacobin               — Jacobin Foundation, QID unverified
--   democracy-now         — Democracy Now! Productions, ownership model unclear
--   salon                 — Salon.com LLC / Salon Media Group, post-2019 acq.
--   the-federalist        — FDRLST Media, QID unverified
--   oann                  — Herring Networks, QID unverified
--   realclearpolitics     — RealClear Holdings, QID unverified
--   the-dispatch          — The Dispatch Media, QID unverified
--   the-epoch-times       — Epoch Media Group, ownership disputed

BEGIN;

-- ---------------------------------------------------------------------------
-- Part A: restore the two QIDs NULLed in 056
-- ---------------------------------------------------------------------------
-- These are the QIDs for the *outlets themselves* on Wikidata (not their
-- owners). They populate sources.wikidata_qid so a future seed-ownership.ts
-- dry-run treats both outlets as `confirmed` against their existing 056
-- owner links (IAC for the-daily-beast, currently unlinked for the-epoch-
-- times — owner researched separately).

UPDATE sources SET wikidata_qid = 'Q1759845' WHERE slug = 'the-daily-beast';  -- The Daily Beast
UPDATE sources SET wikidata_qid = 'Q1624770' WHERE slug = 'the-epoch-times';  -- The Epoch Times

-- ---------------------------------------------------------------------------
-- Part B: insert 5 new owners (manual, all with verified QIDs)
-- ---------------------------------------------------------------------------
-- Format mirrors migrations 048 + 056. owner_source = 'manual' + explicit
-- owner_verified_at = now() for audit clarity. ON CONFLICT (slug) DO NOTHING
-- makes this migration safe to rerun.

INSERT INTO media_owners (name, slug, owner_type, is_individual, country, wikidata_qid, owner_source, owner_verified_at) VALUES
  ('Forbes Media LLC',                 'forbes-media',                'private_company', false, 'United States', 'Q1504008',  'manual', now()),
  ('Foundation for National Progress', 'foundation-national-progress','nonprofit',       false, 'United States', 'Q5471676',  'manual', now()),
  ('First Look Institute',             'first-look-institute',        'nonprofit',       false, 'United States', 'Q15725898', 'manual', now()),
  ('Reason Foundation',                'reason-foundation',           'nonprofit',       false, 'United States', 'Q3735173',  'manual', now()),
  ('News World Communications',        'news-world-communications',   'private_company', false, 'United States', 'Q7004322',  'manual', now())
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Part C: link the 5 sources to their new owners
-- ---------------------------------------------------------------------------
-- Each UPDATE is guarded by `owner_id IS NULL` so a preexisting manual
-- correction on any of these slugs is never silently clobbered. If a
-- slug turns out to be already linked at migration time the UPDATE is a
-- no-op and the operator can investigate the drift before re-applying.

UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'forbes-media')                 WHERE slug = 'forbes' AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'foundation-national-progress') WHERE slug = 'mother-jones' AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'first-look-institute')         WHERE slug = 'the-intercept' AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'reason-foundation')            WHERE slug = 'reason' AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'news-world-communications')    WHERE slug = 'washington-times' AND owner_id IS NULL;

COMMIT;
