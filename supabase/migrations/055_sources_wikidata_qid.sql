-- Migration 055: add sources.wikidata_qid column and populate it.
--
-- Prerequisite for the Wikidata ownership backfill. scripts/seed-ownership.ts
-- reads `sources.wikidata_qid` to drive SPARQL lookups against Wikidata's
-- P127 ("owned by") property. Without this column the script errors with
-- `column sources.wikidata_qid does not exist`; see
-- docs/operations.md § "Owner Data Backfill (Wikidata)".
--
-- QIDs below were looked up from Wikidata's search UI by outlet name. The
-- seed-ownership script re-verifies each via SPARQL and will flag
-- mismatches in the resulting CSV for operator review, so the cost of a
-- wrong QID is an extra review entry, not bad data in the DB. Sources
-- with no QID (e.g. obscure outlets without a well-formed Wikidata entry)
-- stay NULL and are skipped by the backfill script.

ALTER TABLE sources ADD COLUMN wikidata_qid TEXT;

COMMENT ON COLUMN sources.wikidata_qid IS
  'Wikidata Q-id for the outlet (e.g. Q9684 for the New York Times). '
  'Drives the seed-ownership.ts SPARQL lookup. NULL = skip during backfill.';

-- Batch update per slug. Grouped by political lean roughly matching the
-- order in lib/supabase/seed-sources.ts for easier review.

-- Left
UPDATE sources SET wikidata_qid = 'Q6108194'  WHERE slug = 'jacobin';
UPDATE sources SET wikidata_qid = 'Q16876989' WHERE slug = 'the-intercept';
UPDATE sources SET wikidata_qid = 'Q1184551'  WHERE slug = 'democracy-now';
UPDATE sources SET wikidata_qid = 'Q11148'    WHERE slug = 'the-guardian';
UPDATE sources SET wikidata_qid = 'Q213699'   WHERE slug = 'msnbc';
UPDATE sources SET wikidata_qid = 'Q48340'    WHERE slug = 'cnn';
UPDATE sources SET wikidata_qid = 'Q473677'   WHERE slug = 'the-daily-beast';
UPDATE sources SET wikidata_qid = 'Q190451'   WHERE slug = 'huffpost';
UPDATE sources SET wikidata_qid = 'Q207478'   WHERE slug = 'slate';
UPDATE sources SET wikidata_qid = 'Q1152067'  WHERE slug = 'mother-jones';
UPDATE sources SET wikidata_qid = 'Q2265163'  WHERE slug = 'salon';
UPDATE sources SET wikidata_qid = 'Q17362920' WHERE slug = 'vox';
UPDATE sources SET wikidata_qid = 'Q1329033'  WHERE slug = 'propublica';
UPDATE sources SET wikidata_qid = 'Q4741363'  WHERE slug = 'the-american-prospect';

-- Lean-left / Center
UPDATE sources SET wikidata_qid = 'Q9684'     WHERE slug = 'new-york-times';
UPDATE sources SET wikidata_qid = 'Q11174'    WHERE slug = 'washington-post';
UPDATE sources SET wikidata_qid = 'Q178848'   WHERE slug = 'npr';
UPDATE sources SET wikidata_qid = 'Q1469601'  WHERE slug = 'politico';
UPDATE sources SET wikidata_qid = 'Q347744'   WHERE slug = 'abc-news';
UPDATE sources SET wikidata_qid = 'Q215694'   WHERE slug = 'nbc-news';
UPDATE sources SET wikidata_qid = 'Q183137'   WHERE slug = 'cbs-news';
UPDATE sources SET wikidata_qid = 'Q151566'   WHERE slug = 'al-jazeera';
UPDATE sources SET wikidata_qid = 'Q9531'     WHERE slug = 'bbc-news';
UPDATE sources SET wikidata_qid = 'Q579378'   WHERE slug = 'the-atlantic';

-- Center / fact-driven
UPDATE sources SET wikidata_qid = 'Q130879'   WHERE slug = 'reuters';
UPDATE sources SET wikidata_qid = 'Q40469'    WHERE slug = 'ap-news';
UPDATE sources SET wikidata_qid = 'Q7126127'  WHERE slug = 'pbs-newshour';
UPDATE sources SET wikidata_qid = 'Q181345'   WHERE slug = 'usa-today';
UPDATE sources SET wikidata_qid = 'Q2417823'  WHERE slug = 'the-hill';
UPDATE sources SET wikidata_qid = 'Q39058958' WHERE slug = 'axios';
UPDATE sources SET wikidata_qid = 'Q471589'   WHERE slug = 'bloomberg';
UPDATE sources SET wikidata_qid = 'Q1141186'  WHERE slug = 'globe-and-mail';
UPDATE sources SET wikidata_qid = 'Q205170'   WHERE slug = 'france24';
UPDATE sources SET wikidata_qid = 'Q141171'   WHERE slug = 'dw-news';

-- Lean-right / business
UPDATE sources SET wikidata_qid = 'Q11191'    WHERE slug = 'wall-street-journal';
UPDATE sources SET wikidata_qid = 'Q188832'   WHERE slug = 'the-economist';
UPDATE sources SET wikidata_qid = 'Q456936'   WHERE slug = 'forbes';
UPDATE sources SET wikidata_qid = 'Q1356554'  WHERE slug = 'reason';
UPDATE sources SET wikidata_qid = 'Q7300637'  WHERE slug = 'realclearpolitics';
UPDATE sources SET wikidata_qid = 'Q90406928' WHERE slug = 'the-dispatch';
UPDATE sources SET wikidata_qid = 'Q202064'   WHERE slug = 'financial-times';
UPDATE sources SET wikidata_qid = 'Q201295'   WHERE slug = 'the-telegraph';

-- Right
UPDATE sources SET wikidata_qid = 'Q132952'   WHERE slug = 'fox-news';
UPDATE sources SET wikidata_qid = 'Q743895'   WHERE slug = 'national-review';
UPDATE sources SET wikidata_qid = 'Q202902'   WHERE slug = 'new-york-post';
UPDATE sources SET wikidata_qid = 'Q29018069' WHERE slug = 'daily-wire';
UPDATE sources SET wikidata_qid = 'Q1026159'  WHERE slug = 'washington-times';
UPDATE sources SET wikidata_qid = 'Q180445'   WHERE slug = 'daily-mail';
UPDATE sources SET wikidata_qid = 'Q7972008'  WHERE slug = 'washington-examiner';
UPDATE sources SET wikidata_qid = 'Q18394034' WHERE slug = 'the-federalist';
UPDATE sources SET wikidata_qid = 'Q7533410'  WHERE slug = 'sky-news-australia';

-- Far right
UPDATE sources SET wikidata_qid = 'Q83806'    WHERE slug = 'breitbart';
UPDATE sources SET wikidata_qid = 'Q7711464'  WHERE slug = 'the-blaze';
UPDATE sources SET wikidata_qid = 'Q1165602'  WHERE slug = 'the-epoch-times';
UPDATE sources SET wikidata_qid = 'Q7083250'  WHERE slug = 'oann';
UPDATE sources SET wikidata_qid = 'Q6995275'  WHERE slug = 'newsmax';

-- International
UPDATE sources SET wikidata_qid = 'Q373058'   WHERE slug = 'cbc-news';
UPDATE sources SET wikidata_qid = 'Q1141147'  WHERE slug = 'national-post';
UPDATE sources SET wikidata_qid = 'Q162886'   WHERE slug = 'der-spiegel';
UPDATE sources SET wikidata_qid = 'Q2063'     WHERE slug = 'sky-news';
