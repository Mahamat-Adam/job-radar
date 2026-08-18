import type { Prefs } from './types'

/**
 * Everything the app remembers lives in this browser. There is no account and
 * no server, which means saves and likes do not follow you to another device.
 * The export/import pair below is the deliberate escape hatch for that.
 */

const KEY = 'jobradar.prefs.v1'

export const EMPTY: Prefs = {
  saved: [],
  liked: [],
  hidden: [],
  weights: {},
  lastVisit: null,
  countries: [],
}

export function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      saved: parsed.saved ?? [],
      liked: parsed.liked ?? [],
      hidden: parsed.hidden ?? [],
      weights: parsed.weights ?? {},
      lastVisit: parsed.lastVisit ?? null,
      countries: parsed.countries ?? [],
    }
  } catch {
    // A corrupted value should not brick the page.
    return { ...EMPTY }
  }
}

export function save(prefs: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Private browsing and full quotas both throw here. Losing a save is
    // annoying but not worth interrupting the session over.
  }
}

export function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export function exportPrefs(prefs: Prefs): string {
  return JSON.stringify({ kind: 'jobradar-prefs', version: 1, ...prefs }, null, 2)
}

export function importPrefs(json: string): Prefs {
  const parsed = JSON.parse(json) as Partial<Prefs> & { kind?: string }
  if (parsed.kind !== 'jobradar-prefs') throw new Error('That is not a Job Radar backup file.')
  return {
    saved: parsed.saved ?? [],
    liked: parsed.liked ?? [],
    hidden: parsed.hidden ?? [],
    weights: parsed.weights ?? {},
    lastVisit: parsed.lastVisit ?? null,
    countries: parsed.countries ?? [],
  }
}

/**
 * The CV is kept in memory for the session only, never written to storage.
 * Storing it would put the document in a place other scripts on the origin
 * could reach, and the whole point is that it stays put.
 */
