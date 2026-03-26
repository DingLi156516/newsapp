import type { Page, Route } from '@playwright/test'

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

export async function mockBookmarks(page: Page) {
  const bookmarks = new Set<string>()

  await page.route('**/api/bookmarks', async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      return json(route, {
        success: true,
        data: [...bookmarks],
      })
    }

    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { storyId?: string }
      if (body.storyId) bookmarks.add(body.storyId)

      return json(route, {
        success: true,
        data: { storyId: body.storyId ?? null },
      })
    }

    return route.continue()
  })

  await page.route('**/api/bookmarks/*', async (route) => {
    const request = route.request()

    if (request.method() === 'DELETE') {
      const storyId = request.url().split('/').pop()
      if (storyId) bookmarks.delete(decodeURIComponent(storyId))

      return json(route, { success: true })
    }

    return route.continue()
  })
}
