import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AGGREGATORS } from './sources/aggregators.mjs'
import { atsBoards } from './sources/ats.mjs'
import { SEARCH_QUERIES, isWanted, groupOf } from './roles.mjs'
import { extractSkills } from './lib/tags.mjs'
import {
  cleanTitle,
  fingerprint,
  quality,
  summarize,
  toCountries,
  toRemote,
  toSalary,
  toSeniority,
  sponsorSignal,
} from './lib/normalize.mjs'

/**
 * Builds public/data/jobs.json.
 *
 * Runs on a schedule in CI. It is deliberately conservative: sources are
 * fetched one at a time, a source that fails is skipped rather than fatal, and
 * the previous index is read first so that a bad run degrades to "no new jobs"
 * instead of wiping everything.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(root, 'public/data/jobs.json')
const CACHE = path.join(root, 'pipeline/.cache/raw.json')

const args = process.argv.slice(2)
const PROBE = args.includes('--probe')
/**
 * Reprocess the last fetch instead of hitting the network.
 *
 * Every run saves what it gathered, so tuning the filters or the scoring costs
 * nothing and asks nothing of the sources. Only used when developing; CI always
 * fetches fresh.
 */
const FROM_CACHE = args.includes('--from-cache')

/**
 * Nothing older than three months, whatever the source.
 *
 * Listings from a company's own board are still verified as live every day, so
 * an old one is not necessarily filled. But a role that has sat open for many
 * months is rarely an urgent hire, and it crowds out fresher postings. Three
 * months is the point past which a listing stops being worth an application.
 *
 * Feeds are cut sooner still: they carry no signal that a role is even open,
 * so an unverifiable six-week-old copy is mostly noise.
 */
const MAX_AGE_FEED = 45
const MAX_AGE_DIRECT = 90

const log = (m) => console.log(m)
const now = new Date()
const nowIso = now.toISOString()

function loadPrevious() {
  try {
    const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'))
    return Array.isArray(prev?.jobs) ? prev.jobs : []
  } catch {
    return []
  }
}

async function collect(answered) {
  const raw = []
  const report = []

  const sources = [
    { s: atsBoards, opts: { log, answered } },
    ...AGGREGATORS.map((s) => ({
      s,
      opts: {
        queries: SEARCH_QUERIES,
        industries: ['engineering', 'dev'],
        pages: PROBE ? 1 : 3,
      },
    })),
  ]

  for (const { s, opts } of sources) {
    const started = Date.now()
    log(`\n  ${s.name}…`)
    try {
      const rows = await s.fetch(opts)
      raw.push(...rows.map((r) => ({ ...r, direct: r.direct ?? s.direct })))
      report.push({ name: s.name, got: rows.length, ok: true, ms: Date.now() - started })
      log(`  ${s.name}: ${rows.length} raw listings in ${Math.round((Date.now() - started) / 1000)}s`)
    } catch (e) {
      report.push({ name: s.name, got: 0, ok: false, error: e.message })
      log(`  ${s.name}: FAILED — ${e.message}`)
    }
  }
  return { raw, report }
}

function normalizeAll(raw, previousSeen) {
  const feedCutoff = Date.now() - MAX_AGE_FEED * 86_400_000
  const directCutoff = Date.now() - MAX_AGE_DIRECT * 86_400_000
  const kept = new Map()

  let dropped = { title: 0, url: 0, stale: 0, thin: 0, dupe: 0 }

  for (const r of raw) {
    const title = cleanTitle(r.title)
    if (!isWanted(title)) {
      dropped.title++
      continue
    }
    if (!r.url || !/^https?:\/\//.test(r.url)) {
      dropped.url++
      continue
    }

    const posted = r.posted && Number.isFinite(Date.parse(r.posted)) ? r.posted : null
    const cutoff = r.direct ? directCutoff : feedCutoff
    if (posted && Date.parse(posted) < cutoff) {
      dropped.stale++
      continue
    }

    const description = String(r.description ?? '')
    const haystack = `${title}\n${description}\n${r.extra ?? ''}`
    const q = quality({
      posted,
      url: r.url,
      description,
      source: r.source,
      company: r.company,
      direct: r.direct,
    })
    if (q < 0.35) {
      dropped.thin++
      continue
    }

    const id = fingerprint(r.company, title)
    const countries = toCountries(`${r.location ?? ''} ${r.extra ?? ''}`)

    const job = {
      id,
      title,
      company: String(r.company ?? '').trim().slice(0, 90) || 'Unknown',
      countries,
      location: String(r.location ?? '').trim().slice(0, 120) || 'Worldwide',
      remote: toRemote(`${r.location ?? ''} ${title} ${description.slice(0, 900)}`, r.remoteHint),
      seniority: toSeniority(title, description),
      // A feed with no date is treated as seen today rather than dropped,
      // but it scores lower for it.
      posted: posted ?? nowIso,
      seen: previousSeen.get(id) ?? nowIso,
      verified: nowIso,
      direct: r.direct === true,
      url: r.url,
      source: r.source,
      tags: extractSkills(haystack),
      summary: summarize(description),
      quality: Math.round(q * 100) / 100,
    }

    const salary = toSalary(`${r.extra ?? ''} ${description.slice(0, 2500)}`)
    if (salary) job.salary = salary
    if (sponsorSignal(haystack)) job.sponsor = true

    const existing = kept.get(id)
    if (!existing) {
      kept.set(id, job)
    } else {
      dropped.dupe++
      // Prefer the employer's own posting, then the better-scored one, then
      // the one that actually carries a date.
      const better =
        (job.direct === true && existing.direct !== true) ||
        job.quality > existing.quality ||
        (job.quality === existing.quality && job.posted < existing.posted)
      if (better) {
        // Countries and tags are unioned so a merge never loses coverage.
        job.countries = [...new Set([...existing.countries, ...job.countries])]
        job.tags = [...new Set([...existing.tags, ...job.tags])]
        job.seen = existing.seen
        kept.set(id, job)
      } else {
        existing.countries = [...new Set([...existing.countries, ...job.countries])]
        existing.tags = [...new Set([...existing.tags, ...job.tags])]
      }
    }
  }

  return { jobs: [...kept.values()], dropped }
}

async function main() {
  log('Job Radar — collecting')
  log(`  ${nowIso}`)
  if (PROBE) log('  probe mode: one page per source, index is not written')

  const previous = loadPrevious()
  const previousSeen = new Map(previous.map((j) => [j.id, j.seen]))
  log(`  previous index: ${previous.length} listings`)

  /** Company boards that responded this run, whether or not they had roles. */
  let answered = new Set()
  let raw
  let report = []

  if (FROM_CACHE) {
    const cached = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
    raw = cached.raw
    answered = new Set(cached.answered)
    log(`  reprocessing ${raw.length} cached listings from ${cached.at} (no network)`)
  } else {
    const res = await collect(answered)
    raw = res.raw
    report = res.report
    // Saved before any processing, so a mistake further down never costs
    // another round of requests to the sources.
    fs.mkdirSync(path.dirname(CACHE), { recursive: true })
    fs.writeFileSync(CACHE, JSON.stringify({ at: nowIso, answered: [...answered], raw }))
  }
  log(`\n  ${raw.length} raw listings gathered`)

  const { jobs, dropped } = normalizeAll(raw, previousSeen)

  log('\n  filtering')
  log(`    off-target title   ${dropped.title}`)
  log(`    missing apply link ${dropped.url}`)
  log(`    too old            ${dropped.stale}`)
  log(`    too thin           ${dropped.thin}`)
  log(`    duplicates merged  ${dropped.dupe}`)
  log(`  ${jobs.length} listings kept`)

  /* Decide what to do with listings the previous index had but today's run did
     not return.

     For a company board that answered today, absence is meaningful: the role
     came off their careers page, so it has been filled or withdrawn and it
     goes. For a board that did not answer, and for every aggregator, absence
     proves nothing, so the listing is carried forward until it ages out. That
     is what stops one bad morning from emptying the site. */
  const seenNow = new Set(jobs.map((j) => j.id))
  const feedCutoff = Date.now() - MAX_AGE_FEED * 86_400_000
  const directCutoff = Date.now() - MAX_AGE_DIRECT * 86_400_000

  let carried = 0
  let closed = 0
  let agedOut = 0

  for (const j of previous) {
    if (seenNow.has(j.id)) continue

    if (j.direct && answered.has(j.company)) {
      closed++
      continue
    }
    if (Date.parse(j.posted) < (j.direct ? directCutoff : feedCutoff)) {
      agedOut++
      continue
    }
    jobs.push(j)
    carried++
  }

  if (closed) log(`  ${closed} listing(s) removed — no longer on the employer's board`)
  if (agedOut) log(`  ${agedOut} listing(s) aged out`)
  if (carried) log(`  ${carried} listing(s) carried over unconfirmed`)

  jobs.sort((a, b) => Date.parse(b.posted) - Date.parse(a.posted))

  const byCountry = {}
  const bySource = {}
  let worldwide = 0
  for (const j of jobs) {
    bySource[j.source] = (bySource[j.source] ?? 0) + 1
    if (!j.countries.length) worldwide++
    for (const c of j.countries) byCountry[c] = (byCountry[c] ?? 0) + 1
  }

  const groups = {}
  for (const j of jobs) {
    const g = groupOf(j.title) ?? 'other'
    groups[g] = (groups[g] ?? 0) + 1
  }

  log('\n  by source')
  for (const [k, v] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) log(`    ${k}: ${v}`)
  log('\n  by role group')
  for (const [k, v] of Object.entries(groups).sort((a, b) => b[1] - a[1])) log(`    ${k}: ${v}`)
  log(`\n  countries covered: ${Object.keys(byCountry).length}`)
  log(`  open worldwide:    ${worldwide}`)
  log(`  mention sponsorship: ${jobs.filter((j) => j.sponsor).length}`)

  const failed = report.filter((r) => !r.ok)
  if (failed.length) log(`\n  ${failed.length} source(s) failed: ${failed.map((f) => f.name).join(', ')}`)

  if (PROBE) {
    log('\n  probe complete, nothing written')
    return
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      meta: {
        generated: nowIso,
        total: jobs.length,
        byCountry,
        bySource,
        worldwide,
      },
      jobs,
    })
  )
  const kb = fs.statSync(OUT).size / 1024
  log(`\n  wrote public/data/jobs.json — ${jobs.length} listings, ${kb.toFixed(0)}kb`)
}

main().catch((e) => {
  console.error('\nCollection failed:', e)
  process.exit(1)
})
