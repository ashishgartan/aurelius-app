// public/sw.js
// Minimal service worker — caches the app shell for offline support.
// Strategy: network-first for API calls, cache-first for static assets.

const CACHE = "aurelius-v1"
const OFFLINE = "/offline"

// Assets to pre-cache on install
const PRECACHE = ["/", "/offline", "/appIcon.png", "/icon-192.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  // Remove old caches
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
        )
      )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return

  // API calls — network only, no caching
  if (url.pathname.startsWith("/api/")) return

  // Navigation requests — network first, offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE) ?? caches.match("/"))
    )
    return
  }

  // Static assets — cache first, then network
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((res) => {
          // Cache successful responses for static assets
          if (
            res.ok &&
            (url.pathname.match(/\.(png|ico|svg|woff2?)$/) ||
              url.pathname === "/")
          ) {
            const clone = res.clone()
            caches.open(CACHE).then((cache) => cache.put(request, clone))
          }
          return res
        })
    )
  )
})
