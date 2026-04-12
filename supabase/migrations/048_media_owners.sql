-- 048_media_owners.sql — Media ownership entity + FK on sources.
--
-- Adds a media_owners table tracking specific corporate/institutional owners
-- of news sources (distinct from the broad ownership *category* on sources).
-- Seeds 20 owners from the Phase 9B spike CSV and links them to sources.

-- ---------------------------------------------------------------------------
-- 1. Create media_owners table
-- ---------------------------------------------------------------------------

CREATE TABLE media_owners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  owner_type      TEXT NOT NULL CHECK (owner_type IN (
    'public_company', 'private_company', 'cooperative',
    'public_broadcaster', 'trust', 'individual',
    'state_adjacent', 'nonprofit'
  )),
  is_individual   BOOLEAN NOT NULL DEFAULT false,
  country         TEXT,
  wikidata_qid    TEXT,
  parent_owner_id UUID REFERENCES media_owners(id) ON DELETE SET NULL,
  owner_source    TEXT NOT NULL DEFAULT 'manual' CHECK (owner_source IN ('wikidata', 'manual')),
  owner_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_owners_owner_type ON media_owners(owner_type);

-- Auto-update updated_at on row changes (reuses trigger function from 001)
CREATE TRIGGER set_media_owners_updated_at
  BEFORE UPDATE ON media_owners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: public read, admin-only writes (consistent with sources table)
ALTER TABLE media_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY media_owners_select ON media_owners
  FOR SELECT USING (true);

CREATE POLICY media_owners_admin_insert ON media_owners
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY media_owners_admin_update ON media_owners
  FOR UPDATE USING (is_admin());

CREATE POLICY media_owners_admin_delete ON media_owners
  FOR DELETE USING (is_admin());

-- ---------------------------------------------------------------------------
-- 2. Add owner_id FK on sources
-- ---------------------------------------------------------------------------

ALTER TABLE sources ADD COLUMN owner_id UUID REFERENCES media_owners(id) ON DELETE SET NULL;
CREATE INDEX idx_sources_owner_id ON sources(owner_id);

-- ---------------------------------------------------------------------------
-- 3. Seed 20 owners from spike CSV
-- ---------------------------------------------------------------------------

INSERT INTO media_owners (name, slug, owner_type, is_individual, country, wikidata_qid, owner_source) VALUES
  ('The New York Times Company',  'new-york-times-company',   'public_company',     false, 'United States', 'Q9684',      'wikidata'),
  ('Fox Corporation',             'fox-corporation',          'public_company',     false, 'United States', 'Q186068',    'wikidata'),
  ('Thomson Reuters',             'thomson-reuters',          'public_company',     false, 'Canada',        'Q130879',    'wikidata'),
  ('Associated Press Cooperative','associated-press',         'cooperative',        false, 'United States', 'Q40469',     'wikidata'),
  ('Guardian Media Group',        'guardian-media-group',     'trust',              false, 'United Kingdom','Q11148',     'wikidata'),
  ('BBC',                         'bbc',                      'public_broadcaster', false, 'United Kingdom','Q9531',      'wikidata'),
  ('Warner Bros. Discovery',      'warner-bros-discovery',    'public_company',     false, 'United States', 'Q48340',     'wikidata'),
  ('Dow Jones & Company',         'dow-jones',                'public_company',     false, 'United States', 'Q164746',    'wikidata'),
  ('Bloomberg L.P.',              'bloomberg-lp',             'private_company',    false, 'United States', 'Q14270642',  'wikidata'),
  ('Axel Springer SE',            'axel-springer',            'public_company',     false, 'Germany',       'Q3109740',   'wikidata'),
  ('Jeff Bezos',                  'jeff-bezos',               'individual',         true,  'United States', 'Q166032',    'wikidata'),
  ('Rothermere Continuation Limited','dmgt',                  'private_company',    false, 'United Kingdom','Q210534',    'manual'),
  ('NPR',                         'npr',                      'nonprofit',          false, 'United States', 'Q671510',    'wikidata'),
  ('Al Jazeera Media Network',    'al-jazeera-media-network', 'state_adjacent',     false, 'Qatar',         'Q13477',     'wikidata'),
  ('Emerson Collective',          'emerson-collective',       'private_company',    false, 'United States', 'Q1542536',   'wikidata'),
  ('BuzzFeed',                    'buzzfeed',                 'public_company',     false, 'United States', 'Q18049522',  'wikidata'),
  ('Cox Enterprises',             'cox-enterprises',          'private_company',    false, 'United States', 'Q28230873',  'wikidata'),
  ('Breitbart News Network LLC',  'breitbart-news-network',   'private_company',    false, 'United States', 'Q4960434',   'manual'),
  ('Penske Media Corporation',    'penske-media',             'private_company',    false, 'United States', 'Q7942354',   'manual'),
  ('National Review Institute',   'national-review-institute','nonprofit',          false, 'United States', 'Q1699649',   'manual');

-- ---------------------------------------------------------------------------
-- 4. Link sources to owners using corrected slug mapping
-- ---------------------------------------------------------------------------

-- 7 remapped slugs (CSV slug → DB slug):
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'new-york-times-company')   WHERE slug = 'new-york-times';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'fox-corporation')          WHERE slug = 'fox-news';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'thomson-reuters')          WHERE slug = 'reuters';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'associated-press')         WHERE slug = 'ap-news';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'guardian-media-group')     WHERE slug = 'the-guardian';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'bbc')                     WHERE slug = 'bbc-news';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'warner-bros-discovery')    WHERE slug = 'cnn';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'dow-jones')                WHERE slug = 'wall-street-journal';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'bloomberg-lp')             WHERE slug = 'bloomberg';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'axel-springer')            WHERE slug = 'politico';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'jeff-bezos')               WHERE slug = 'washington-post';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'dmgt')                     WHERE slug = 'daily-mail';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'npr')                      WHERE slug = 'npr';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'al-jazeera-media-network') WHERE slug = 'al-jazeera';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'emerson-collective')       WHERE slug = 'the-atlantic';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'buzzfeed')                 WHERE slug = 'huffpost';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'cox-enterprises')          WHERE slug = 'axios';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'breitbart-news-network')   WHERE slug = 'breitbart';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'penske-media')             WHERE slug = 'vox';
UPDATE sources SET owner_id = (SELECT id FROM media_owners WHERE slug = 'national-review-institute') WHERE slug = 'national-review';
