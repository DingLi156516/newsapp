-- Migration 016: Constrain story_kind to 'standard' only (remove emerging_single_source)
UPDATE stories SET story_kind = 'standard' WHERE story_kind != 'standard';
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_story_kind_check;
ALTER TABLE stories ADD CONSTRAINT stories_story_kind_check CHECK (story_kind = 'standard');
