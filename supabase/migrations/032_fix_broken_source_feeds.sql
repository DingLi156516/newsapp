-- Migration 032: Fix broken RSS source feeds
--
-- 7 sources updated with working RSS URLs
-- 6 sources deactivated (no viable public RSS)
-- 1 source reset (Washington Post — intermittent, confirmed working)

-- Fix 7 sources with known-good alternative RSS URLs
UPDATE sources SET rss_url = 'https://feeds.bloomberg.com/politics/news.rss',
  consecutive_failures = 0, last_fetch_error = NULL
  WHERE slug = 'bloomberg';

UPDATE sources SET rss_url = 'https://www.forbes.com/news/feed2/',
  consecutive_failures = 0, last_fetch_error = NULL
  WHERE slug = 'forbes';

UPDATE sources SET rss_url = 'https://www.economist.com/international/rss.xml',
  consecutive_failures = 0, last_fetch_error = NULL
  WHERE slug = 'the-economist';

UPDATE sources SET rss_url = 'https://feeds.nbcnews.com/nbcnews/public/news',
  consecutive_failures = 0, last_fetch_error = NULL
  WHERE slug = 'msnbc';

UPDATE sources SET rss_url = 'https://feed.theepochtimes.com/us/feed',
  consecutive_failures = 0, last_fetch_error = NULL
  WHERE slug = 'the-epoch-times';

UPDATE sources SET rss_url = 'https://rss.cbc.ca/lineup/topstories.xml',
  consecutive_failures = 0, last_fetch_error = NULL
  WHERE slug = 'cbc-news';

UPDATE sources SET rss_url = 'https://www.thedailybeast.com/arc/outboundfeeds/rss/articles/',
  consecutive_failures = 0, last_fetch_error = NULL
  WHERE slug = 'the-daily-beast';

-- Deactivate 6 sources with no viable public RSS
-- Null rss_url and clear stale health metadata to match seed state
UPDATE sources SET is_active = false, rss_url = NULL,
  consecutive_failures = 0, last_fetch_error = NULL, last_fetch_status = NULL,
  last_fetch_at = NULL
  WHERE slug IN ('reuters', 'ap-news', 'cnn', 'sky-news-australia', 'usa-today', 'newsmax');

-- Reset Washington Post failures (intermittent, feed confirmed working)
UPDATE sources SET consecutive_failures = 0, last_fetch_error = NULL
  WHERE slug = 'washington-post';
