-- Unpublish all emerging single-source stories while keeping the data
UPDATE stories
SET publication_status = 'rejected',
    review_status = 'rejected'
WHERE story_kind = 'emerging_single_source'
  AND publication_status != 'rejected';
