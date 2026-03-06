-- Phase 2a: Seed data for the sources table
-- 55 news outlets across the political spectrum with bias, factuality, ownership metadata

INSERT INTO sources (slug, name, bias, factuality, ownership, url, rss_url, region) VALUES
-- Far Left
('jacobin', 'Jacobin', 'far-left', 'mixed', 'independent', 'jacobin.com', 'https://jacobin.com/feed', 'us'),
('the-intercept', 'The Intercept', 'far-left', 'high', 'non-profit', 'theintercept.com', 'https://theintercept.com/feed/?lang=en', 'us'),
('democracy-now', 'Democracy Now!', 'far-left', 'high', 'non-profit', 'democracynow.org', 'https://www.democracynow.org/democracynow.rss', 'us'),

-- Left
('the-guardian', 'The Guardian', 'left', 'high', 'non-profit', 'theguardian.com', 'https://www.theguardian.com/us-news/rss', 'uk'),
('msnbc', 'MSNBC', 'left', 'mixed', 'corporate', 'msnbc.com', 'https://www.msnbc.com/feeds/latest', 'us'),
('cnn', 'CNN', 'left', 'mixed', 'corporate', 'cnn.com', 'http://rss.cnn.com/rss/cnn_topstories.rss', 'us'),
('the-daily-beast', 'The Daily Beast', 'left', 'mixed', 'corporate', 'thedailybeast.com', 'https://feeds.thedailybeast.com/rss/articles', 'us'),
('huffpost', 'HuffPost', 'left', 'mixed', 'corporate', 'huffpost.com', 'https://www.huffpost.com/section/front-page/feed', 'us'),

-- Lean Left
('new-york-times', 'New York Times', 'lean-left', 'high', 'corporate', 'nytimes.com', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', 'us'),
('washington-post', 'Washington Post', 'lean-left', 'high', 'corporate', 'washingtonpost.com', 'https://feeds.washingtonpost.com/rss/national', 'us'),
('npr', 'NPR', 'lean-left', 'very-high', 'non-profit', 'npr.org', 'https://feeds.npr.org/1001/rss.xml', 'us'),
('politico', 'Politico', 'lean-left', 'high', 'corporate', 'politico.com', 'https://rss.politico.com/politics-news.xml', 'us'),
('abc-news', 'ABC News', 'lean-left', 'high', 'corporate', 'abcnews.go.com', 'https://abcnews.go.com/abcnews/topstories', 'us'),
('nbc-news', 'NBC News', 'lean-left', 'high', 'corporate', 'nbcnews.com', 'https://feeds.nbcnews.com/nbcnews/public/news', 'us'),
('cbs-news', 'CBS News', 'lean-left', 'high', 'corporate', 'cbsnews.com', 'https://www.cbsnews.com/latest/rss/main', 'us'),
('al-jazeera', 'Al Jazeera', 'lean-left', 'high', 'state-funded', 'aljazeera.com', 'https://www.aljazeera.com/xml/rss/all.xml', 'international'),
('bbc-news', 'BBC News', 'lean-left', 'very-high', 'state-funded', 'bbc.com', 'https://feeds.bbci.co.uk/news/rss.xml', 'uk'),
('the-atlantic', 'The Atlantic', 'lean-left', 'high', 'corporate', 'theatlantic.com', 'https://www.theatlantic.com/feed/all/', 'us'),
('vox', 'Vox', 'lean-left', 'high', 'corporate', 'vox.com', 'https://www.vox.com/rss/index.xml', 'us'),

-- Center
('reuters', 'Reuters', 'center', 'very-high', 'corporate', 'reuters.com', 'https://www.reutersagency.com/feed/', 'international'),
('ap-news', 'AP News', 'center', 'very-high', 'non-profit', 'apnews.com', 'https://rsshub.app/apnews/topics/apf-topnews', 'us'),
('pbs-newshour', 'PBS NewsHour', 'center', 'very-high', 'non-profit', 'pbs.org/newshour', 'https://www.pbs.org/newshour/feeds/rss/headlines', 'us'),
('usa-today', 'USA Today', 'center', 'high', 'corporate', 'usatoday.com', 'http://rssfeeds.usatoday.com/usatoday-NewsTopStories', 'us'),
('the-hill', 'The Hill', 'center', 'high', 'corporate', 'thehill.com', 'https://thehill.com/feed/', 'us'),
('axios', 'Axios', 'center', 'high', 'corporate', 'axios.com', 'https://api.axios.com/feed/', 'us'),
('bloomberg', 'Bloomberg', 'center', 'high', 'corporate', 'bloomberg.com', 'https://www.bloomberg.com/feed/podcast/bloomberg-surveillance.xml', 'us'),
('globe-and-mail', 'The Globe and Mail', 'center', 'high', 'corporate', 'theglobeandmail.com', 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/canada/', 'canada'),
('france24', 'France 24', 'center', 'high', 'state-funded', 'france24.com', 'https://www.france24.com/en/rss', 'europe'),
('dw-news', 'DW News', 'center', 'very-high', 'state-funded', 'dw.com', 'https://rss.dw.com/rdf/rss-en-all', 'europe'),

-- Lean Right
('wall-street-journal', 'Wall Street Journal', 'lean-right', 'high', 'corporate', 'wsj.com', 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', 'us'),
('the-economist', 'The Economist', 'lean-right', 'very-high', 'corporate', 'economist.com', 'https://www.economist.com/rss', 'uk'),
('forbes', 'Forbes', 'lean-right', 'high', 'corporate', 'forbes.com', 'https://www.forbes.com/real-time/feed2/', 'us'),
('reason', 'Reason', 'lean-right', 'high', 'non-profit', 'reason.com', 'https://reason.com/feed/', 'us'),
('realclearpolitics', 'RealClearPolitics', 'lean-right', 'high', 'independent', 'realclearpolitics.com', 'https://www.realclearpolitics.com/index.xml', 'us'),
('the-dispatch', 'The Dispatch', 'lean-right', 'very-high', 'independent', 'thedispatch.com', 'https://thedispatch.com/feed/', 'us'),
('financial-times', 'Financial Times', 'lean-right', 'very-high', 'corporate', 'ft.com', 'https://www.ft.com/?format=rss', 'uk'),
('the-telegraph', 'The Telegraph', 'lean-right', 'high', 'corporate', 'telegraph.co.uk', 'https://www.telegraph.co.uk/rss.xml', 'uk'),

-- Right
('fox-news', 'Fox News', 'right', 'mixed', 'corporate', 'foxnews.com', 'https://moxie.foxnews.com/google-publisher/latest.xml', 'us'),
('national-review', 'National Review', 'right', 'mixed', 'independent', 'nationalreview.com', 'https://www.nationalreview.com/feed/', 'us'),
('new-york-post', 'New York Post', 'right', 'mixed', 'corporate', 'nypost.com', 'https://nypost.com/feed/', 'us'),
('daily-wire', 'Daily Wire', 'right', 'mixed', 'independent', 'dailywire.com', 'https://www.dailywire.com/feeds/rss.xml', 'us'),
('washington-times', 'Washington Times', 'right', 'mixed', 'independent', 'washingtontimes.com', 'https://www.washingtontimes.com/rss/headlines/news/', 'us'),
('daily-mail', 'Daily Mail', 'right', 'low', 'corporate', 'dailymail.co.uk', 'https://www.dailymail.co.uk/articles.rss', 'uk'),
('washington-examiner', 'Washington Examiner', 'right', 'mixed', 'corporate', 'washingtonexaminer.com', 'https://www.washingtonexaminer.com/feed', 'us'),
('the-federalist', 'The Federalist', 'right', 'mixed', 'independent', 'thefederalist.com', 'https://thefederalist.com/feed/', 'us'),
('sky-news-australia', 'Sky News Australia', 'right', 'mixed', 'corporate', 'skynews.com.au', 'https://www.skynews.com.au/rss', 'international'),

-- Far Right
('breitbart', 'Breitbart', 'far-right', 'low', 'independent', 'breitbart.com', 'https://feeds.feedburner.com/breitbart', 'us'),
('the-blaze', 'The Blaze', 'far-right', 'mixed', 'independent', 'theblaze.com', 'https://www.theblaze.com/feeds/feed.rss', 'us'),
('the-epoch-times', 'The Epoch Times', 'far-right', 'mixed', 'independent', 'theepochtimes.com', 'https://www.theepochtimes.com/c-us/feed', 'us'),
('oann', 'One America News', 'far-right', 'low', 'independent', 'oann.com', 'https://www.oann.com/feed/', 'us'),
('newsmax', 'Newsmax', 'far-right', 'low', 'corporate', 'newsmax.com', 'https://www.newsmax.com/rss/Newsfront/1/', 'us'),

-- International / Regional
('cbc-news', 'CBC News', 'lean-left', 'high', 'state-funded', 'cbc.ca', 'https://www.cbc.ca/webfeed/rss/rss-topstories', 'canada'),
('national-post', 'National Post', 'lean-right', 'high', 'corporate', 'nationalpost.com', 'https://nationalpost.com/feed', 'canada'),
('der-spiegel', 'Der Spiegel', 'lean-left', 'high', 'corporate', 'spiegel.de', 'https://www.spiegel.de/international/index.rss', 'europe'),
('sky-news', 'Sky News', 'lean-right', 'high', 'corporate', 'news.sky.com', 'https://feeds.skynews.com/feeds/rss/home.xml', 'uk');
