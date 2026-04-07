-- Migration 030: Add third-party bias rating provider columns to sources table.
-- Stores per-provider bias/factuality ratings and supports manual override.

ALTER TABLE sources ADD COLUMN bias_mbfc TEXT DEFAULT NULL
  CHECK (bias_mbfc IS NULL OR bias_mbfc IN ('far-left','left','lean-left','center','lean-right','right','far-right'));

ALTER TABLE sources ADD COLUMN bias_allsides TEXT DEFAULT NULL
  CHECK (bias_allsides IS NULL OR bias_allsides IN ('far-left','left','lean-left','center','lean-right','right','far-right'));

ALTER TABLE sources ADD COLUMN bias_adfm TEXT DEFAULT NULL
  CHECK (bias_adfm IS NULL OR bias_adfm IN ('far-left','left','lean-left','center','lean-right','right','far-right'));

ALTER TABLE sources ADD COLUMN factuality_mbfc TEXT DEFAULT NULL
  CHECK (factuality_mbfc IS NULL OR factuality_mbfc IN ('very-high','high','mixed','low','very-low'));

ALTER TABLE sources ADD COLUMN factuality_allsides TEXT DEFAULT NULL
  CHECK (factuality_allsides IS NULL OR factuality_allsides IN ('very-high','high','mixed','low','very-low'));

ALTER TABLE sources ADD COLUMN bias_override BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE sources ADD COLUMN bias_sources_synced_at TIMESTAMPTZ DEFAULT NULL;
