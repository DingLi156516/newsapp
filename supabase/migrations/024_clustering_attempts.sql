ALTER TABLE articles
  ADD COLUMN clustering_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN clustering_status text NOT NULL DEFAULT 'pending';
-- clustering_status values: 'pending', 'clustered', 'expired'

CREATE INDEX idx_articles_clustering_status ON articles (clustering_status)
  WHERE clustering_status = 'pending';
