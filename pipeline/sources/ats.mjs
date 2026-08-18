import { getJson, stripHtml } from '../lib/http.mjs'
import { BOARDS } from '../companies.mjs'

/**
 * Company career-page APIs.
 *
 * These are the best listings in the index: the data comes straight from the
 * employer's own hiring system, so there is no aggregator lag, no reposting,
 * and the apply link is the real one. The cost is that each company must be
 * asked separately, which is why the run is capped and staggered.
 *
 * A board that has been renamed or closed returns 404, which is expected and
 * simply skipped. The run reports which ones failed so the list can be pruned.
 */

const iso = (v) => {
  if (v === null || v === undefined) return null
  const ms = typeof v === 'number' ? (v < 1e11 ? v * 1000 : v) : Date.parse(v)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/** Greenhouse escapes its HTML content, so it needs decoding before stripping. */
const unescapeHtml = (s) =>
  String(s ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

async function greenhouse(token, company) {
  const data = await getJson(
    `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`
  )
  return (data?.jobs ?? []).map((j) => ({
    source: 'Greenhouse',
    direct: true,
    title: j.title,
    company,
    location: j.location?.name ?? '',
    url: j.absolute_url,
    // Greenhouse exposes no reliable first-published date on this endpoint,
    // so the last update is the honest best available.
    posted: iso(j.first_published ?? j.updated_at),
    description: stripHtml(unescapeHtml(j.content)),
    extra: (j.departments ?? []).map((d) => d.name).join(' '),
  }))
}

async function lever(token, company) {
  const data = await getJson(`https://api.lever.co/v0/postings/${token}?mode=json`)
  const rows = Array.isArray(data) ? data : []
  return rows.map((j) => ({
    source: 'Lever',
    direct: true,
    title: j.text,
    company,
    location: j.categories?.allLocations?.join(', ') || j.categories?.location || '',
    remoteHint: /remote/i.test(j.workplaceType ?? '') ? true : undefined,
    url: j.hostedUrl || j.applyUrl,
    posted: iso(j.createdAt),
    description: [j.descriptionPlain, j.additionalPlain].filter(Boolean).join('\n\n'),
    extra: [j.categories?.commitment, j.categories?.department, j.categories?.team]
      .filter(Boolean)
      .join(' '),
  }))
}

async function ashby(token, company) {
  const data = await getJson(
    `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`
  )
  return (data?.jobs ?? [])
    .filter((j) => j.isListed !== false)
    .map((j) => ({
      source: 'Ashby',
      direct: true,
      title: j.title,
      company,
      location: [j.location, ...(j.secondaryLocations ?? []).map((l) => l?.location)]
        .filter(Boolean)
        .join(', '),
      remoteHint: j.isRemote === true ? true : undefined,
      url: j.jobUrl || j.applyUrl,
      posted: iso(j.publishedAt),
      description: j.descriptionPlain || stripHtml(j.descriptionHtml),
      extra: [j.department, j.team, j.employmentType, j.compensation?.compensationTierSummary]
        .filter(Boolean)
        .join(' '),
    }))
}

const FETCHERS = { greenhouse, lever, ashby }

export const atsBoards = {
  name: 'Company boards',
  direct: true,
  /**
   * Also reports which boards answered. That set is what lets the run tell
   * "this role was filled" apart from "this company's board was down today",
   * which decides whether a listing is removed or kept.
   */
  async fetch({ log, answered }) {
    const out = []
    const dead = []

    for (const board of BOARDS) {
      const fn = FETCHERS[board.ats]
      if (!fn) continue
      try {
        const rows = await fn(board.token, board.name)
        answered?.add(board.name)
        if (rows.length) {
          out.push(...rows)
          log?.(`    ${board.name} (${board.ats}) — ${rows.length}`)
        } else {
          log?.(`    ${board.name} (${board.ats}) — no open roles`)
        }
      } catch (e) {
        dead.push(`${board.name} (${board.ats}): ${e.message}`)
      }
    }

    if (dead.length) {
      log?.(`    ${dead.length} board(s) did not answer:`)
      for (const d of dead) log?.(`      ${d}`)
    }
    return out
  },
}
