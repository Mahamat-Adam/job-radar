import type { IndexMeta, Job } from './types'

/**
 * The job index is a static file generated on a schedule and served alongside
 * the app. Fetching it is the only network request the site makes after load.
 */

export type Index = { meta: IndexMeta; jobs: Job[] }

const base = () => import.meta.env.BASE_URL

export async function loadIndex(): Promise<Index> {
  /*
   * A timeout, because on mobile data the normal failure is a request that
   * hangs rather than one that fails. Without it the page sat on "Loading the
   * index…" indefinitely with no error and no way back but a manual reload —
   * and the service worker's cached copy was never reached either, since it
   * only falls back when the fetch actually rejects.
   */
  const res = await fetch(`${base()}data/jobs.json`, {
    cache: 'no-cache',
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) throw new Error(`Job index unavailable (${res.status})`)
  const data = (await res.json()) as Index
  // Both halves are checked: reading meta off an index that only had `jobs`
  // threw during render and left a blank white page rather than the error banner.
  if (!Array.isArray(data.jobs) || !data.meta || typeof data.meta !== 'object') {
    throw new Error('Job index is malformed')
  }
  return data
}

/**
 * How recently this opportunity was known to be live, which is the thing the
 * recency filter is really asking about.
 *
 * For a listing read from the employer's own careers page that is the last
 * time we saw it there. For a feed listing there is no such signal, so the
 * publish date is the best available answer.
 */
export function freshness(job: Job): string {
  return job.direct && job.verified ? job.verified : job.posted
}

export function daysAgo(iso: string, now = Date.now()): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return Infinity
  return Math.floor((now - t) / 86_400_000)
}

export function agoLabel(iso: string, now = Date.now()): string {
  const d = daysAgo(iso, now)
  if (!Number.isFinite(d)) return 'date unknown'
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d} days ago`
  if (d < 14) return 'last week'
  if (d < 31) return `${Math.floor(d / 7)} weeks ago`
  if (d < 62) return 'last month'
  return `${Math.floor(d / 30)} months ago`
}

/** Regional-indicator flag from an ISO-2 code. No image assets needed. */
export function flag(iso2: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso2)) return '🌐'
  return String.fromCodePoint(
    ...iso2
      .toUpperCase()
      .split('')
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  )
}

export function salaryLabel(job: Job): string | null {
  const s = job.salary
  if (!s || (!s.min && !s.max)) return null
  const cur = s.currency ?? ''
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)))
  const per = s.period === 'year' ? '/yr' : s.period === 'month' ? '/mo' : s.period === 'day' ? '/day' : s.period === 'hour' ? '/hr' : ''
  if (s.min && s.max && s.min !== s.max) return `${cur}${fmt(s.min)}–${fmt(s.max)}${per}`
  return `${cur}${fmt((s.min ?? s.max) as number)}${per}`
}
