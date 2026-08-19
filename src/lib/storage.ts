import type { AppStatus, Application, Job, Prefs } from './types'

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
  applications: {},
  weights: {},
  lastVisit: null,
  countries: [],
}

/** Fills in anything a older stored copy is missing, without losing it. */
function hydrate(parsed: Partial<Prefs>): Prefs {
  const saved = parsed.saved ?? []
  const applications = { ...(parsed.applications ?? {}) }

  // Saves made before the tracker existed become the first pipeline stage,
  // rather than sitting outside it and looking like they were lost.
  for (const id of saved) {
    if (!applications[id]) applications[id] = { status: 'saved', at: new Date().toISOString() }
  }

  return {
    saved,
    liked: parsed.liked ?? [],
    hidden: parsed.hidden ?? [],
    applications,
    weights: parsed.weights ?? {},
    lastVisit: parsed.lastVisit ?? null,
    countries: parsed.countries ?? [],
  }
}

export function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    return hydrate(JSON.parse(raw) as Partial<Prefs>)
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

/**
 * Bookmarking and un-bookmarking. Removing a job drops its pipeline record
 * too, so a job cannot sit at "interviewing" while not being saved.
 *
 * The listing itself is copied in, trimmed of the long description, because the
 * record has to outlive the job leaving the index.
 */
export function toggleSaved(prefs: Prefs, id: string, job?: Job): Prefs {
  if (prefs.saved.includes(id)) {
    const applications = { ...prefs.applications }
    delete applications[id]
    return { ...prefs, saved: prefs.saved.filter((x) => x !== id), applications }
  }
  return {
    ...prefs,
    saved: [...prefs.saved, id],
    applications: {
      ...prefs.applications,
      [id]: { status: 'saved', at: new Date().toISOString(), job: job ? snapshot(job) : undefined },
    },
  }
}

/** Enough to render a card, without carrying a few kilobytes of prose per row. */
function snapshot(job: Job): Job {
  return { ...job, summary: job.summary.slice(0, 240) }
}

export function setStatus(prefs: Prefs, id: string, status: AppStatus): Prefs {
  const now = new Date().toISOString()
  const current = prefs.applications[id]
  const next: Application = {
    status,
    at: now,
    // The date you applied is worth keeping once set — it is what tells you a
    // reply is overdue — so later stages do not overwrite it.
    appliedAt: status === 'applied' ? (current?.appliedAt ?? now) : current?.appliedAt,
    note: current?.note,
    job: current?.job,
  }
  return {
    ...prefs,
    saved: prefs.saved.includes(id) ? prefs.saved : [...prefs.saved, id],
    applications: { ...prefs.applications, [id]: next },
  }
}

export function setNote(prefs: Prefs, id: string, note: string): Prefs {
  const current = prefs.applications[id]
  if (!current) return prefs
  return { ...prefs, applications: { ...prefs.applications, [id]: { ...current, note } } }
}

export function exportPrefs(prefs: Prefs): string {
  return JSON.stringify({ kind: 'jobradar-prefs', version: 2, ...prefs }, null, 2)
}

export function importPrefs(json: string): Prefs {
  const parsed = JSON.parse(json) as Partial<Prefs> & { kind?: string }
  if (parsed.kind !== 'jobradar-prefs') throw new Error('That is not a Job Radar backup file.')
  return hydrate(parsed)
}

/**
 * The CV is kept in memory for the session only, never written to storage.
 * Storing it would put the document in a place other scripts on the origin
 * could reach, and the whole point is that it stays put.
 */
