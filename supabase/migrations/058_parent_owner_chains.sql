-- Migration 058: wire parent_owner_id for known conglomerate chains.
--
-- Context. media_owners.parent_owner_id has been in the schema since 048 but
-- has never been populated. Without it, rollup queries over corporate parents
-- (future: "Comcast controls 2 properties across its subsidiaries") show
-- NBCUniversal and Comcast as disconnected rows. This migration populates
-- the column for pairs whose parent/child relationship is unambiguous and
-- already represented in media_owners after 048 + 056 + 057.
--
-- Chains wired:
--   nbcuniversal           → comcast           (from 056)
--   dow-jones              → news-corp         (Dow Jones in 048; News Corp in 056)
--
-- Data-only. No UI surface is added on this branch — that becomes a
-- standalone follow-up once the data lands and the rollup design is known.
--
-- Safety:
--   - The UPDATEs use IS DISTINCT FROM so a rerun is a no-op after the first
--     apply. No cycle risk: none of the wired children have parent_owner_id
--     pointing back up the chain.
--   - Every chain asserts that both parent and child rows exist before any
--     write. If a prerequisite row is missing (drift, partial seed, stale
--     environment) the migration fails loudly instead of silently writing
--     NULL into parent_owner_id or clearing an existing link.

BEGIN;

DO $$
DECLARE
  v_parent_id UUID;
  v_child_id  UUID;
BEGIN
  SELECT id INTO v_parent_id FROM media_owners WHERE slug = 'comcast';
  SELECT id INTO v_child_id  FROM media_owners WHERE slug = 'nbcuniversal';
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'Missing media_owners row: comcast (required by 058 nbcuniversal→comcast chain)';
  END IF;
  IF v_child_id IS NULL THEN
    RAISE EXCEPTION 'Missing media_owners row: nbcuniversal (required by 058 nbcuniversal→comcast chain)';
  END IF;
  UPDATE media_owners
     SET parent_owner_id = v_parent_id
   WHERE id = v_child_id
     AND parent_owner_id IS DISTINCT FROM v_parent_id;
END $$;

DO $$
DECLARE
  v_parent_id UUID;
  v_child_id  UUID;
BEGIN
  SELECT id INTO v_parent_id FROM media_owners WHERE slug = 'news-corp';
  SELECT id INTO v_child_id  FROM media_owners WHERE slug = 'dow-jones';
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'Missing media_owners row: news-corp (required by 058 dow-jones→news-corp chain)';
  END IF;
  IF v_child_id IS NULL THEN
    RAISE EXCEPTION 'Missing media_owners row: dow-jones (required by 058 dow-jones→news-corp chain)';
  END IF;
  UPDATE media_owners
     SET parent_owner_id = v_parent_id
   WHERE id = v_child_id
     AND parent_owner_id IS DISTINCT FROM v_parent_id;
END $$;

COMMIT;
