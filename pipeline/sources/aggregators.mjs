import { getJson, stripHtml } from '../lib/http.mjs'

/**
 * Public job feeds that need no key and no account.
 *
 * Each adapter returns raw records in one shape; normalisation happens later
 * so that adding a source never means touching the scoring code. A source that
 * throws is skipped for the day rather than failing the run.
 */

/**
 * Feeds are not consistent about list fields — the same key arrives as an
 * array, a comma-joined string, or null depending on the record. Coercing
 * rather than trusting the shape keeps one odd row from failing the source.
 */
const list = (v) => {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' || typeof x === 'number')
  if (typeof v === 'string') return v.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
  return []
}

const iso = (v) => {
  if (!v) return null
  if (typeof v === 'number') {
    // Seconds or milliseconds, depending on the feed.
    const ms = v < 1e11 ? v * 1000 : v
    const d = new Date(ms)
    return Number.isFinite(d.getTime()) ? d.toISOString() : null
  }
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

export const remotive = {
  name: 'Remotive',
  direct: false,
  async fetch({ queries }) {
    const out = []
    for (const q of queries) {
      const data = await getJson(
        `https://remotive.com/api/remote-jobs?limit=100&search=${encodeURIComponent(q)}`
      )
      for (const j of data?.jobs ?? []) {
        out.push({
          source: 'Remotive',
          title: j.title,
          company: j.company_name,
          location: j.candidate_required_location || 'Remote',
          remoteHint: true,
          url: j.url,
          posted: iso(j.publication_date),
          description: stripHtml(j.description),
          extra: `${j.salary ?? ''} ${list(j.tags).join(' ')}`,
        })
      }
    }
    return out
  },
}

export const arbeitnow = {
  name: 'Arbeitnow',
  direct: false,
  /*
   * Paged deeper than the rest on purpose.
   *
   * This feed is where the employer variety comes from: 183 listings across 120
   * distinct employers, against 679 listings from 139 employers for all the
   * curated boards combined. Stopping at three pages was cutting it off at 67
   * matching roles from 50 employers, where eleven pages reaches 181 from 127.
   * getJson already spaces every request and backs off on a 429, so depth here
   * costs run time rather than politeness.
   */
  pages: 10,
  async fetch({ pages = 3 }) {
    const out = []
    for (let p = 1; p <= pages; p++) {
      const data = await getJson(`https://www.arbeitnow.com/api/job-board-api?page=${p}`)
      const rows = data?.data ?? []
      if (!rows.length) break
      for (const j of rows) {
        out.push({
          source: 'Arbeitnow',
          title: j.title,
          company: j.company_name,
          location: j.location || (j.remote ? 'Remote' : ''),
          remoteHint: j.remote === true ? true : undefined,
          url: j.url,
          posted: iso(j.created_at),
          description: stripHtml(j.description),
          extra: [...list(j.tags), ...list(j.job_types)].join(' '),
        })
      }
    }
    return out
  },
}

export const jobicy = {
  name: 'Jobicy',
  direct: false,
  async fetch({ industries }) {
    const out = []
    for (const industry of industries) {
      const data = await getJson(
        `https://jobicy.com/api/v2/remote-jobs?count=50&industry=${encodeURIComponent(industry)}`
      )
      for (const j of data?.jobs ?? []) {
        const salary =
          j.annualSalaryMin && j.annualSalaryMax
            ? `${j.salaryCurrency ?? ''}${j.annualSalaryMin} - ${j.salaryCurrency ?? ''}${j.annualSalaryMax} per year`
            : ''
        out.push({
          source: 'Jobicy',
          title: j.jobTitle,
          // companyName is literally "name" on many rows; the slug is correct.
          company: j.companyName && j.companyName !== 'name' ? j.companyName : j.companySlug,
          location: j.jobGeo || 'Anywhere',
          remoteHint: true,
          url: j.url,
          posted: iso(j.pubDate),
          description: stripHtml(j.jobDescription || j.jobExcerpt),
          extra: `${salary} ${list(j.jobLevel).join(' ')} ${list(j.jobIndustry).join(' ')}`,
        })
      }
    }
    return out
  },
}

/**
 * Himalayas' companyName is not dependable: about half the rows carry the
 * literal string "name", and others arrive wrapped in angle brackets such as
 * "<Vem pra Ponta>". Being non-empty, all of it sailed past the usual fallback
 * and 16 listings published their employer as "name". The slug beside it is
 * always clean, so it is the answer whenever the name is not usable.
 */
const PLACEHOLDER = /^(?:name|company|companyname|null|undefined|n\/?a|-)$/i

function himalayasCompany(j) {
  const named = String(j.companyName ?? '').replace(/[<>]/g, '').trim()
  if (named && !PLACEHOLDER.test(named)) return named
  return String(j.companySlug ?? '')
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export const himalayas = {
  name: 'Himalayas',
  direct: false,
  async fetch({ pages = 3 }) {
    const out = []
    for (let p = 0; p < pages; p++) {
      const data = await getJson(`https://himalayas.app/jobs/api?limit=100&offset=${p * 100}`)
      const rows = data?.jobs ?? []
      if (!rows.length) break
      for (const j of rows) {
        const salary =
          j.minSalary && j.maxSalary ? `USD${j.minSalary} - USD${j.maxSalary} per year` : ''
        out.push({
          source: 'Himalayas',
          title: j.title,
          company: himalayasCompany(j),
          location: list(j.locationRestrictions).join(', ') || 'Worldwide',
          remoteHint: true,
          url: j.applicationLink || j.guid,
          posted: iso(j.pubDate),
          description: stripHtml(j.description || j.excerpt),
          extra: `${salary} ${list(j.seniority).join(' ')} ${list(j.categories).join(' ')}`,
        })
      }
    }
    return out
  },
}

export const AGGREGATORS = [remotive, arbeitnow, jobicy, himalayas]
