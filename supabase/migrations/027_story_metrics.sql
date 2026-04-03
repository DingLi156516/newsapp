-- Migration 027: Add computed story metrics columns
-- story_velocity: JSONB with articles_24h, articles_48h, articles_7d, phase
-- impact_score: 0-100 composite importance score
-- source_diversity: count of unique ownership types
-- controversy_score: 0.0-1.0 divergence between left/right framing

ALTER TABLE stories ADD COLUMN story_velocity JSONB DEFAULT NULL;
ALTER TABLE stories ADD COLUMN impact_score SMALLINT DEFAULT NULL;
ALTER TABLE stories ADD COLUMN source_diversity SMALLINT DEFAULT NULL;
ALTER TABLE stories ADD COLUMN controversy_score REAL DEFAULT NULL;
