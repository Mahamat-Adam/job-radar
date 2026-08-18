/**
 * Offline support.
 *
 * The app shell is cached so the site opens instantly and still opens with no
 * connection, which is the point of adding it to a phone home screen. The job
 * index is fetched from the network first and only falls back to the cached
 * copy when offline, so a stale list is never shown while a fresh one is
 * available.
 */

const VERSION = 'v1'
const SHELL = `jobradar-shell-${VERSION}`
const DATA = `jobradar-data-${VERSION}`

/** Resolved against the service worker's own location, so the repo subpath works. */
const BASE = new URL('./', self.location).pathname

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll([BASE, `${BASE}index.html`, `${BASE}manifest.webmanifest`]))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Job data: always try the network, fall back to the last good copy.
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(DATA).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit ?? Response.error()))
    )
    return
  }

  // Navigations: network first so a new build is picked up, shell as fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(`${BASE}index.html`).then((hit) => hit ?? Response.error())
      )
    )
    return
  }

  // Build assets are content-hashed, so a cache hit is always correct.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (
            res.ok &&
            (url.pathname.includes('/assets/') ||
              url.pathname.includes('/icons/') ||
              url.pathname.includes('/fonts/'))
          ) {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put(req, copy))
          }
          return res
        })
    )
  )
})
