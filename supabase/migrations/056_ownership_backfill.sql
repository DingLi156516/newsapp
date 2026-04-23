-- Migration 056: hand-authored ownership backfill.
--
-- Context. Migration 055 added sources.wikidata_qid so that
-- scripts/seed-ownership.ts could drive a Wikidata SPARQL backfill of owners.
-- A dry-run of that script (2026-04-22) produced effectively zero usable
-- output: 45 sources were skipped because the script only queries Wikidata
-- property P127 ("owned by"), while most news outlets use P749 ("parent
-- organization") or P123 ("publisher"); and 2 of the QIDs in 055 turned out
-- to be wrong (Q-id collisions against unrelated entities).
--
-- To unblock owner-page coverage today, this migration:
--   Part A: NULLs the two incorrect QIDs in 055 so the script stops
--           producing wrong inserts for those outlets.
--   Part B: Hand-authors 18 new owners and links 18 sources to them,
--           taking ownership coverage from 20 → 38 of 54 active sources.
--
-- All new owners use owner_source = 'manual' since they are not derived from
-- a verified Wikidata query. The QIDs below are recorded for future
-- cross-reference once scripts/seed-ownership.ts is extended to also chase
-- P749 + P123; see docs/operations.md § "Owner Data Backfill (Wikidata)".

BEGIN;

-- ---------------------------------------------------------------------------
-- Part A: correct two bad QIDs from migration 055
-- ---------------------------------------------------------------------------
-- Q473677  (the-daily-beast) resolved to Cistercians, a 12th-century Catholic
--          religious order.
-- Q1165602 (the-epoch-times) resolved to VIVAQUA, a Belgian water utility.
-- NULL both rather than guess again — an operator can supply correct QIDs
-- in a follow-up after manual Wikidata lookup.

UPDATE sources SET wikidata_qid = NULL WHERE slug = 'the-daily-beast';
UPDATE sources SET wikidata_qid = NULL WHERE slug = 'the-epoch-times';

-- ---------------------------------------------------------------------------
-- Part B: insert 18 new owners
-- ---------------------------------------------------------------------------
-- Format mirrors migration 048. owner_source = 'manual' and owner_verified_at
-- is set explicitly to now() for audit clarity. ON CONFLICT (slug) DO NOTHING
-- makes this migration safe to rerun.

INSERT INTO media_owners (name, slug, owner_type, is_individual, country, wikidata_qid, owner_source, owner_verified_at) VALUES
  ('NBCUniversal',                    'nbcuniversal',         'private_company',    false, 'United States', 'Q229979',    'manual', now()),
  ('Comcast Corporation',             'comcast',              'public_company',     false, 'United States', 'Q22633',     'manual', now()),
  ('IAC Inc.',                        'iac',                  'public_company',     false, 'United States', 'Q1419675',   'manual', now()),
  ('Graham Holdings Company',         'graham-holdings',      'public_company',     false, 'United States', 'Q1542729',   'manual', now()),
  ('Public Broadcasting Service',     'pbs',                  'public_broadcaster', false, 'United States', 'Q230561',    'manual', now()),
  ('Nexstar Media Group',             'nexstar-media',        'public_company',     false, 'United States', 'Q14914810',  'manual', now()),
  ('The Economist Group',             'economist-group',      'private_company',    false, 'United Kingdom','Q5363319',   'manual', now()),
  ('Nikkei Inc.',                     'nikkei',               'public_company',     false, 'Japan',         'Q1140491',   'manual', now()),
  ('Telegraph Media Group',           'telegraph-media-group','private_company',    false, 'United Kingdom','Q3978069',   'manual', now()),
  ('News Corp',                       'news-corp',            'public_company',     false, 'United States', 'Q193199',    'manual', now()),
  ('Clarity Media Group',             'clarity-media',        'private_company',    false, 'United States', 'Q5128058',   'manual', now()),
  ('Canadian Broadcasting Corporation','cbc-radio-canada',    'public_broadcaster', false, 'Canada',        'Q373058',    'manual', now()),
  ('Postmedia Network',               'postmedia',            'public_company',     false, 'Canada',        'Q1140196',   'manual', now()),
  ('Spiegel-Verlag',                  'spiegel-verlag',       'private_company',    false, 'Germany',       'Q458704',    'manual', now()),
  ('The Woodbridge Company',          'woodbridge',           'private_company',    false, 'Canada',        'Q8033973',   'manual', now()),
  ('France Médias Monde',             'france-medias-monde',  'public_broadcaster', false, 'France',        'Q3074381',   'manual', now()),
  ('Deutsche Welle',                  'deutsche-welle',       'public_broadcaster', false, 'Germany',       'Q151721',    'manual', now()),
  ('Pro Publica Inc.',                'propublica-inc',       'nonprofit',          false, 'United States', 'Q1329033',   'manual', now())
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Link the 18 sources to their new owners
-- ---------------------------------------------------------------------------
-- Each UPDATE is guarded by `owner_id IS NULL` so a preexisting manual
-- correction on any of these slugs is never silently clobbered. If a
-- slug turns out to be already linked at migration time the UPDATE is a
-- no-op and the operator can investigate the drift before re-applying.

UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'nbcuniversal')          WHERE slug = 'msnbc'               AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'comcast')               WHERE slug = 'sky-news'            AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'iac')                   WHERE slug = 'the-daily-beast'     AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'graham-holdings')       WHERE slug = 'slate'               AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'pbs')                   WHERE slug = 'pbs-newshour'        AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'nexstar-media')         WHERE slug = 'the-hill'            AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'economist-group')       WHERE slug = 'the-economist'       AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'nikkei')                WHERE slug = 'financial-times'     AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'telegraph-media-group') WHERE slug = 'the-telegraph'       AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'news-corp')             WHERE slug = 'new-york-post'       AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'clarity-media')         WHERE slug = 'washington-examiner' AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'cbc-radio-canada')      WHERE slug = 'cbc-news'            AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'postmedia')             WHERE slug = 'national-post'       AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'spiegel-verlag')        WHERE slug = 'der-spiegel'         AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'woodbridge')            WHERE slug = 'globe-and-mail'      AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'france-medias-monde')   WHERE slug = 'france24'            AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'deutsche-welle')        WHERE slug = 'dw-news'             AND owner_id IS NULL;
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'propublica-inc')        WHERE slug = 'propublica'          AND owner_id IS NULL;

COMMIT;
