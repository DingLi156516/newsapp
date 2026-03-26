-- Auto-publish stories only blocked by blindspot and/or low_factuality
-- (review_reasons is jsonb, not text[])
UPDATE stories
SET publication_status = 'published',
    review_status = 'approved',
    published_at = NOW()
WHERE publication_status = 'needs_review'
  AND review_reasons <@ '["blindspot", "low_factuality"]'::jsonb;

-- Auto-publish legacy migration stories
UPDATE stories
SET publication_status = 'published',
    review_status = 'approved',
    published_at = NOW()
WHERE publication_status = 'needs_review'
  AND review_reasons = '["legacy_pending_review"]'::jsonb;

-- Clean blindspot/low_factuality from combo-reason stories (keep other reasons active)
UPDATE stories
SET review_reasons = (
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements_text(review_reasons) AS elem
  WHERE elem NOT IN ('blindspot', 'low_factuality')
)
WHERE publication_status = 'needs_review'
  AND (review_reasons ? 'blindspot' OR review_reasons ? 'low_factuality');
