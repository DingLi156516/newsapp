/**
 * lib/crawler/js-renderer.ts — Optional Playwright-based JS rendering.
 *
 * Dynamic import wrapper. Throws descriptive error if Playwright is not installed.
 * Used only when a source has jsRender: true in its CrawlerConfig.
 */

export async function renderWithJavaScript(url: string): Promise<string> {
  try {
    // Dynamic import — Playwright is an optional dependency
    const { chromium } = await import('playwright')

    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15_000 })
      const html = await page.content()
      return html
    } finally {
      await browser.close()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (message.includes('Cannot find module') || message.includes('MODULE_NOT_FOUND')) {
      throw new Error(
        'Playwright is not installed. Install it with: npm install playwright. ' +
        'JS rendering is optional — set jsRender: false in the source config to use static HTML parsing.'
      )
    }

    throw new Error(`JS rendering failed for ${url}: ${message}`)
  }
}
