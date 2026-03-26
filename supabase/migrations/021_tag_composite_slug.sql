-- Migration 021: Replace global slug uniqueness with composite (slug, tag_type)
--
-- Problem: tags.slug is globally unique, so two entity types with the same
-- label (e.g. "Jordan" as a person vs location) can never coexist. The upsert
-- silently reuses the wrong tag row, corrupting tag_type and merging unrelated
-- story counts.
--
-- Fix: composite unique on (slug, tag_type) allows the same slug across
-- different entity types while preventing duplicates within a type.

-- Drop the global unique constraint (created by UNIQUE in CREATE TABLE)
ALTER TABLE tags DROP CONSTRAINT tags_slug_key;

-- Drop the now-redundant standalone slug index
DROP INDEX IF EXISTS idx_tags_slug;

-- Composite unique: same label can exist as different entity types
ALTER TABLE tags ADD CONSTRAINT tags_slug_tag_type_key UNIQUE (slug, tag_type);

-- Non-unique slug index for tag-detail lookups by slug alone
CREATE INDEX idx_tags_slug ON tags (slug);
