/**
 * lib/sample-data.ts — Static mock data used in place of a real API.
 *
 * This file substitutes for a backend API endpoint. In a production app you
 * would replace these arrays with actual fetch/SWR/React Query calls to your
 * server. The data shape here exactly matches the interfaces in `lib/types.ts`.
 *
 * Data:
 *   - sampleSources: A flat list of 15 well-known news outlets with bias,
 *     factuality, and ownership metadata.
 *   - sampleArticles: 6 fully fleshed-out clustered stories, each referencing
 *     a subset of the sources above.
 */
import type { NewsArticle, NewsSource } from './types'

/**
 * Master list of news outlets in the system.
 * In production this would be a DB table (e.g., `sources`) seeded from
 * a data provider like AllSides or Media Bias/Fact Check.
 *
 * Array index matters here — articles reference sources by index
 * (e.g., sampleSources[0] is The Guardian), so don't re-order.
 */
export const sampleSources: NewsSource[] = [
  { id: 's1', slug: 'the-guardian', name: 'The Guardian', bias: 'left', factuality: 'high', ownership: 'non-profit', region: 'uk', url: 'theguardian.com' },
  { id: 's2', slug: 'bbc-news', name: 'BBC News', bias: 'center', factuality: 'very-high', ownership: 'state-funded', region: 'uk', url: 'bbc.com' },
  { id: 's3', slug: 'reuters', name: 'Reuters', bias: 'center', factuality: 'very-high', ownership: 'corporate', region: 'international', url: 'reuters.com' },
  { id: 's4', slug: 'fox-news', name: 'Fox News', bias: 'right', factuality: 'mixed', ownership: 'corporate', region: 'us', url: 'foxnews.com' },
  { id: 's5', slug: 'msnbc', name: 'MSNBC', bias: 'left', factuality: 'mixed', ownership: 'corporate', region: 'us', url: 'msnbc.com' },
  { id: 's6', slug: 'wall-street-journal', name: 'Wall Street Journal', bias: 'lean-right', factuality: 'high', ownership: 'corporate', region: 'us', url: 'wsj.com' },
  { id: 's7', slug: 'new-york-times', name: 'New York Times', bias: 'lean-left', factuality: 'high', ownership: 'corporate', region: 'us', url: 'nytimes.com' },
  { id: 's8', slug: 'ap-news', name: 'AP News', bias: 'center', factuality: 'very-high', ownership: 'non-profit', region: 'us', url: 'apnews.com' },
  { id: 's9', slug: 'jacobin', name: 'Jacobin', bias: 'far-left', factuality: 'mixed', ownership: 'independent', region: 'us', url: 'jacobin.com' },
  { id: 's10', slug: 'breitbart', name: 'Breitbart', bias: 'far-right', factuality: 'low', ownership: 'independent', region: 'us', url: 'breitbart.com' },
  { id: 's11', slug: 'npr', name: 'NPR', bias: 'lean-left', factuality: 'very-high', ownership: 'non-profit', region: 'us', url: 'npr.org' },
  { id: 's12', slug: 'the-economist', name: 'The Economist', bias: 'lean-right', factuality: 'very-high', ownership: 'corporate', region: 'uk', url: 'economist.com' },
  { id: 's13', slug: 'al-jazeera', name: 'Al Jazeera', bias: 'lean-left', factuality: 'high', ownership: 'state-funded', region: 'international', url: 'aljazeera.com' },
  { id: 's14', slug: 'washington-post', name: 'Washington Post', bias: 'lean-left', factuality: 'high', ownership: 'corporate', region: 'us', url: 'washingtonpost.com' },
  { id: 's15', slug: 'national-review', name: 'National Review', bias: 'right', factuality: 'mixed', ownership: 'independent', region: 'us', url: 'nationalreview.com' },
]

/**
 * The six sample news stories shown in the feed.
 *
 * Each article represents a news event aggregated from multiple outlets.
 * Key fields to understand:
 *
 *   sources          — References into sampleSources[] via array index.
 *                      In production, this would be a join table query.
 *
 *   spectrumSegments — Percentages per bias tier; must sum to ~100.
 *                      In production, computed server-side from source bias
 *                      weighted by how many articles each outlet published.
 *
 *   isBlindspot      — True when one political side has >80% of coverage.
 *                      Article 'a4' (immigration policy) is the only blindspot
 *                      example here — only left-leaning sources covered it.
 *
 *   aiSummary        — In production these strings come from an LLM prompt
 *                      that ingests the top articles from each bias bucket
 *                      and produces structured bullet points.
 *
 *   timestamp        — ISO 8601 format; used to sort in "Latest" feed tab.
 */
export const sampleArticles: NewsArticle[] = [
  {
    id: 'a1',
    headline: 'Global Leaders Reach Landmark Climate Agreement at COP Summit',
    topic: 'environment',
    sourceCount: 43,
    isBlindspot: false,
    imageUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800',
    factuality: 'high',
    ownership: 'non-profit',
    sources: [sampleSources[0], sampleSources[1], sampleSources[2], sampleSources[5], sampleSources[6], sampleSources[7], sampleSources[10]],
    spectrumSegments: [
      { bias: 'far-left', percentage: 5 },
      { bias: 'left', percentage: 22 },
      { bias: 'lean-left', percentage: 28 },
      { bias: 'center', percentage: 25 },
      { bias: 'lean-right', percentage: 14 },
      { bias: 'right', percentage: 6 },
    ],
    aiSummary: {
      commonGround: '• World leaders from 195 countries signed a new climate accord\n• Agreement commits signatories to net-zero emissions by 2050\n• $500 billion climate fund established for developing nations\n• Deal includes binding annual review mechanisms',
      leftFraming: '• Emphasis on corporate accountability and fossil fuel restrictions\n• Calls for faster phase-out timelines, current targets "not enough"\n• Focus on climate justice and disproportionate impact on Global South\n• Criticism of wealthy nations for insufficient financial commitments',
      rightFraming: '• Concerns about economic impact on domestic industries and jobs\n• Questions about enforcement mechanisms and China\'s compliance\n• Arguments for technology-led solutions over regulation\n• Debate over sovereignty implications of binding international targets',
    },
    timestamp: '2026-03-01T08:00:00Z',
    region: 'international',
  },
  {
    id: 'a2',
    headline: 'Federal Reserve Signals Pause in Rate Hikes as Inflation Moderates',
    topic: 'business',
    sourceCount: 67,
    isBlindspot: false,
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800',
    factuality: 'very-high',
    ownership: 'corporate',
    sources: [sampleSources[2], sampleSources[5], sampleSources[6], sampleSources[7], sampleSources[11], sampleSources[3]],
    spectrumSegments: [
      { bias: 'left', percentage: 15 },
      { bias: 'lean-left', percentage: 20 },
      { bias: 'center', percentage: 35 },
      { bias: 'lean-right', percentage: 22 },
      { bias: 'right', percentage: 8 },
    ],
    aiSummary: {
      commonGround: '• Fed held interest rates steady at 4.75%–5.00%\n• Core PCE inflation at 2.4%, approaching 2% target\n• Labor market remains resilient with 3.9% unemployment\n• Chair Powell cited "significant progress" on inflation',
      leftFraming: '• Relief that pause protects working-class homebuyers from higher mortgage rates\n• Calls for rate cuts to boost housing affordability\n• Warning about recession risk if rates remain elevated too long\n• Focus on impact on lower-income households',
      rightFraming: '• Concerns rate cuts too early could reignite inflation\n• Emphasis on Fed maintaining credibility and not being political\n• Arguments for letting market forces play out without intervention\n• Praise for Fed\'s gradual approach to normalization',
    },
    timestamp: '2026-02-28T14:30:00Z',
    region: 'us',
  },
  {
    id: 'a3',
    headline: 'AI Regulation Bill Advances in Senate with Bipartisan Support',
    topic: 'technology',
    sourceCount: 31,
    isBlindspot: false,
    imageUrl: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800',
    factuality: 'high',
    ownership: 'corporate',
    sources: [sampleSources[0], sampleSources[1], sampleSources[6], sampleSources[7], sampleSources[10], sampleSources[11]],
    spectrumSegments: [
      { bias: 'far-left', percentage: 3 },
      { bias: 'left', percentage: 18 },
      { bias: 'lean-left', percentage: 25 },
      { bias: 'center', percentage: 30 },
      { bias: 'lean-right', percentage: 18 },
      { bias: 'right', percentage: 6 },
    ],
    aiSummary: {
      commonGround: '• Senate committee approved AI Safety and Innovation Act 15-2\n• Bill requires risk assessments for high-stakes AI deployments\n• Creates new Federal AI Safety Board with enforcement powers\n• Bipartisan amendment added protections for AI research',
      leftFraming: '• Applause for consumer protections against algorithmic discrimination\n• Calls for stronger data privacy provisions\n• Focus on AI risks to workers and labor displacement\n• Advocacy for open-source AI to democratize access',
      rightFraming: '• Concerns regulation could hamper American AI competitiveness vs China\n• Arguments for industry self-regulation over government mandates\n• Criticism of board\'s broad enforcement powers as overreach\n• Focus on national security benefits of rapid AI development',
    },
    timestamp: '2026-02-27T11:15:00Z',
    region: 'us',
  },
  {
    // isBlindspot: true — 83% of coverage comes from left/lean-left sources.
    // This is the only blindspot article in the sample set.
    id: 'a4',
    headline: 'Conservative Media Largely Silent on Major Immigration Enforcement Reform',
    topic: 'politics',
    sourceCount: 28,
    isBlindspot: true,
    imageUrl: 'https://images.unsplash.com/photo-1575936123452-b67c3203c357?w=800',
    factuality: 'high',
    ownership: 'independent',
    sources: [sampleSources[0], sampleSources[6], sampleSources[7], sampleSources[10], sampleSources[12], sampleSources[13]],
    spectrumSegments: [
      { bias: 'far-left', percentage: 8 },
      { bias: 'left', percentage: 35 },
      { bias: 'lean-left', percentage: 40 },
      { bias: 'center', percentage: 12 },
      { bias: 'lean-right', percentage: 5 },
    ],
    aiSummary: {
      commonGround: '• Department of Homeland Security issued new enforcement guidelines\n• Guidelines create protected status for long-term undocumented residents\n• Policy change affects estimated 4.4 million people\n• Implementation begins in 90 days pending legal challenges',
      leftFraming: '• Celebrations from immigrant rights advocates\n• Framing as humanitarian relief after years of advocacy\n• Stories of families who will benefit from the policy\n• Calls for comprehensive immigration reform legislation',
      rightFraming: '• Minimal coverage from right-leaning outlets\n• Scattered criticism as executive overreach\n• Concerns about border security implications\n• Legal challenges highlighted prominently',
    },
    timestamp: '2026-02-26T09:45:00Z',
    region: 'us',
  },
  {
    id: 'a5',
    headline: 'Breakthrough mRNA Cancer Vaccine Shows 90% Efficacy in Phase III Trial',
    topic: 'health',
    sourceCount: 89,
    isBlindspot: false,
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
    factuality: 'very-high',
    ownership: 'corporate',
    sources: [sampleSources[1], sampleSources[2], sampleSources[6], sampleSources[7], sampleSources[10], sampleSources[11], sampleSources[3], sampleSources[5]],
    spectrumSegments: [
      { bias: 'left', percentage: 20 },
      { bias: 'lean-left', percentage: 25 },
      { bias: 'center', percentage: 30 },
      { bias: 'lean-right', percentage: 18 },
      { bias: 'right', percentage: 7 },
    ],
    aiSummary: {
      commonGround: '• Personalized mRNA cancer vaccine showed 90% efficacy in melanoma trial\n• 18-month Phase III study involved 1,200 patients across 40 sites\n• FDA granted Breakthrough Therapy Designation\n• Vaccine works by targeting tumor-specific mutations\n• Commercial availability projected for late 2027',
      leftFraming: '• Focus on ensuring equitable access for all income levels\n• Concerns about high projected pricing ($200,000+ per course)\n• Calls for Medicare negotiation and price controls\n• Questions about whether insurance will cover treatment',
      rightFraming: '• Celebration of free-market pharmaceutical innovation\n• Arguments that price controls would slow future breakthroughs\n• Focus on economic value vs cost of cancer treatment\n• Emphasis on American biotech leadership globally',
    },
    timestamp: '2026-02-25T16:00:00Z',
    region: 'us',
  },
  {
    id: 'a6',
    headline: 'China Launches World\'s Largest Solar Farm in Gobi Desert',
    topic: 'environment',
    sourceCount: 52,
    isBlindspot: false,
    imageUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800',
    factuality: 'high',
    ownership: 'state-funded',
    sources: [sampleSources[1], sampleSources[2], sampleSources[4], sampleSources[7], sampleSources[11], sampleSources[12]],
    spectrumSegments: [
      { bias: 'far-left', percentage: 4 },
      { bias: 'left', percentage: 18 },
      { bias: 'lean-left', percentage: 28 },
      { bias: 'center', percentage: 32 },
      { bias: 'lean-right', percentage: 14 },
      { bias: 'right', percentage: 4 },
    ],
    aiSummary: {
      commonGround: '• China inaugurated 100GW solar installation in Inner Mongolia\n• Project cost $80 billion and took 3 years to construct\n• Will power 80 million homes and offset 250 million tons of CO2 annually\n• Uses Chinese-made panels manufactured by BYD Solar',
      leftFraming: '• Framing as proof that renewable transition is achievable at scale\n• Calls for US to match China\'s green investment ambition\n• Emphasis on climate benefits and need for similar projects globally\n• Stories about local jobs created in clean energy sector',
      rightFraming: '• Focus on geopolitical implications of China\'s clean energy dominance\n• Concerns about supply chain dependence on Chinese solar technology\n• Arguments for domestic manufacturing incentives\n• Skepticism about reported output figures',
    },
    timestamp: '2026-02-24T07:30:00Z',
    region: 'international',
  },
]

/**
 * Re-exported as `allSources` for use on the /sources directory page.
 * Aliased so the sources page has a semantically clear import name.
 */
export const allSources = sampleSources
