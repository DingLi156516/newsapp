-- 031_pgvector_story_matching.sql
-- HNSW index on story centroids for fast vector search.
-- RPC function for finding matching stories by embedding similarity.

-- HNSW index on story centroids (future-proofs for 1000+ stories)
CREATE INDEX IF NOT EXISTS idx_stories_centroid
  ON stories USING hnsw (cluster_centroid vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RPC: find top-K matching stories for a given embedding
CREATE OR REPLACE FUNCTION match_story_centroid(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.72,
  match_count int DEFAULT 5,
  cutoff_time timestamptz DEFAULT now() - interval '168 hours'
) RETURNS TABLE (story_id uuid, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT s.id, 1 - (s.cluster_centroid <=> query_embedding) AS similarity
  FROM stories s
  WHERE s.cluster_centroid IS NOT NULL
    AND s.last_updated >= cutoff_time
    AND 1 - (s.cluster_centroid <=> query_embedding) >= match_threshold
  ORDER BY s.cluster_centroid <=> query_embedding
  LIMIT match_count;
$$;
