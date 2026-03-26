/**
 * public/service-worker.js — Offline cache for PWA.
 *
 * Handles fetch interception for offline story caching (added by F-09).
 */

/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'axiom-offline-v1'
const STORY_CACHE_NAME = 'axiom-stories-v1'

// Fetch interceptor: network-first with cache fallback for story API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only intercept GET requests to our story API
  if (
    event.request.method !== 'GET' ||
    !url.pathname.startsWith('/api/stories/')
  ) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache the fresh response
        const clone = response.clone()
        caches.open(STORY_CACHE_NAME).then((cache) => {
          cache.put(event.request, clone)
        })
        return response
      })
      .catch(async () => {
        // Network failed — try the cache
        const cached = await caches.match(event.request)
        if (cached) return cached
        return new Response(
          JSON.stringify({ success: false, error: 'Offline' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      })
  )
})

// Install: activate immediately
self.addEventListener('install', () => {
  self.skipWaiting()
})

// Activate: claim all clients and clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME && name !== STORY_CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      ),
    ])
  )
})
