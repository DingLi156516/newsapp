-- Migration 028: Add AI enrichment columns for expanded summary data
-- sentiment: JSONB with left/right sentiment labels
-- key_quotes: JSONB array of notable quotes with source attribution
-- key_claims: JSONB array of claims with side, disputed flag, counter-claims

ALTER TABLE stories ADD COLUMN sentiment JSONB DEFAULT NULL;
ALTER TABLE stories ADD COLUMN key_quotes JSONB DEFAULT NULL;
ALTER TABLE stories ADD COLUMN key_claims JSONB DEFAULT NULL;
