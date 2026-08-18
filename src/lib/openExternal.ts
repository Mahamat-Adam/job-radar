import type { MouseEvent } from 'react'

/**
 * Opens an external URL from a click handler.
 *
 * Anchors with target="_blank" are occasionally refused on mobile Safari,
 * which leaves a tap doing nothing at all. That gets worse once the site is
 * installed to the home screen, where a standalone window has no tab to open
 * into. Trying the new window explicitly and falling back to navigating in
 * place means one tap always goes somewhere.
 */
export function openExternal(event: MouseEvent, url: string) {
  event.preventDefault()
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) window.location.href = url
}
