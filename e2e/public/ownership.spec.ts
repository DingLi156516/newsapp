import { test, expect } from '@playwright/test'

// Mock a story with 5 sources; 3 are owned by Warner Bros. Discovery,
// 1 by NYT Company, 1 unknown owner. Dominant owner at 60% so
// OwnershipSummary renders the "covers N of M sources" headline.
const OWNERSHIP_STORY = {
  id: 'ownership-test-story',
  headline: 'Concentrated ownership test story',
  topic: 'politics',
  sourceCount: 5,
  isBlindspot: false,
  imageUrl: null,
  factuality: 'high',
  ownership: 'corporate',
  timestamp: new Date().toISOString(),
  region: 'us',
  spectrumSegments: [
    { bias: 'lean-left', percentage: 60 },
    { bias: 'center', percentage: 20 },
    { bias: 'right', percentage: 20 },
  ],
  aiSummary: {
    commonGround: 'Test story commonGround',
    leftFraming: 'Test left framing',
    rightFraming: 'Test right framing',
  },
  impactScore: 0.5,
  sourceDiversity: 0.5,
  controversyScore: 0.2,
  sentiment: null,
  keyQuotes: null,
  keyClaims: null,
  sources: [
    makeSource('cnn', 'CNN', 'lean-left', 'warner'),
    makeSource('hbo', 'HBO News', 'center', 'warner'),
    makeSource('tnt', 'TNT News', 'lean-left', 'warner'),
    makeSource('nyt', 'NYT', 'lean-left', 'nyt'),
    makeSource('indie', 'Indie News', 'center', null),
  ],
}

function makeSource(
  id: string,
  name: string,
  bias: string,
  ownerId: 'warner' | 'nyt' | null
) {
  const owners = {
    warner: {
      id: 'warner',
      name: 'Warner Bros. Discovery',
      slug: 'warner-bros-discovery',
      ownerType: 'public_company',
      isIndividual: false,
      country: 'US',
      wikidataQid: 'Q3570967',
      ownerSource: 'manual',
      ownerVerifiedAt: '2026-01-01T00:00:00Z',
    },
    nyt: {
      id: 'nyt',
      name: 'The New York Times Company',
      slug: 'new-york-times-company',
      ownerType: 'public_company',
      isIndividual: false,
      country: 'US',
      wikidataQid: 'Q1315207',
      ownerSource: 'manual',
      ownerVerifiedAt: '2026-01-01T00:00:00Z',
    },
  }
  const base = {
    id,
    slug: id,
    name,
    bias,
    factuality: 'high',
    ownership: 'corporate',
    region: 'us',
    url: `${id}.example`,
    articleUrl: `https://${id}.example/article`,
  }
  return ownerId ? { ...base, owner: owners[ownerId] } : base
}

test.describe('Ownership graph (Phase 2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/stories/ownership-test-story', (route) => {
      if (route.request().url().includes('/timeline')) return route.continue()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: OWNERSHIP_STORY }),
      })
    })
  })

  test('story detail renders OwnershipSummary with dominant owner headline', async ({ page }) => {
    await page.goto('/story/ownership-test-story')

    const summary = page.getByTestId('ownership-summary')
    await expect(summary).toBeVisible({ timeout: 10_000 })
    await expect(summary).toContainText(
      /Warner Bros\. Discovery covers 3 of 5 sources/i
    )
    await expect(page.getByTestId('ownership-bar')).toBeVisible()
  })

  test('sources directory exposes a "Group by owner" toggle that clusters owners', async ({ page }) => {
    // Mock a couple of sources with linked owners so the grouped view has
    // real owner headers, not just "Unaffiliated".
    await page.route('**/api/sources**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            makeSource('cnn', 'CNN', 'lean-left', 'warner'),
            makeSource('hbo', 'HBO News', 'center', 'warner'),
            makeSource('nyt', 'NYT', 'lean-left', 'nyt'),
            makeSource('indie', 'Indie News', 'center', null),
          ],
          meta: { total: 4, page: 1, limit: 50 },
        }),
      })
    })

    await page.goto('/?view=sources')
    await expect(page.getByText(/\d+ sources?/)).toBeVisible({ timeout: 10_000 })

    const toggle = page.getByTestId('group-by-owner-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')

    // Warner group header visible with owner name + source count
    const warnerGroup = page.getByTestId('owner-group-warner')
    await expect(warnerGroup).toBeVisible()
    await expect(warnerGroup).toContainText('Warner Bros. Discovery')

    // Unaffiliated bucket for the source with no owner
    await expect(page.getByTestId('owner-group-unaffiliated')).toBeVisible()
  })
})
