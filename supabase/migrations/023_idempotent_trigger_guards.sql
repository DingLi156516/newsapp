-- 023_idempotent_trigger_guards.sql — Make trigger migrations idempotent.
--
-- Adds DROP TRIGGER IF EXISTS guards for all triggers created in 018/020
-- so migrations can be re-run safely.

-- From 018_entity_tags.sql
DROP TRIGGER IF EXISTS trg_update_tag_story_count ON story_tags;
CREATE TRIGGER trg_update_tag_story_count
AFTER INSERT OR DELETE ON story_tags
FOR EACH ROW
EXECUTE FUNCTION update_tag_story_count();

-- From 020_tag_publication_scoping.sql
DROP TRIGGER IF EXISTS trg_update_tag_counts_on_publication_change ON stories;
CREATE TRIGGER trg_update_tag_counts_on_publication_change
AFTER UPDATE OF publication_status ON stories
FOR EACH ROW
EXECUTE FUNCTION update_tag_counts_on_publication_change();

DROP TRIGGER IF EXISTS trg_update_tag_counts_on_story_delete ON stories;
CREATE TRIGGER trg_update_tag_counts_on_story_delete
BEFORE DELETE ON stories
FOR EACH ROW
EXECUTE FUNCTION update_tag_counts_on_story_delete();
