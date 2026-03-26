-- Migration 009: Add blindspot digest email preference
ALTER TABLE user_preferences ADD COLUMN blindspot_digest_enabled BOOLEAN NOT NULL DEFAULT false;
