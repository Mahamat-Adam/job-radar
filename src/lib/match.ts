import type { CvProfile, Job, Prefs, Seniority } from './types'
import { weightOf } from './skills'

/**
 * Ranking.
 *
 * The score is a weighted sum of four independent signals, then multiplied by
 * two gates. Gates are multipliers rather than penalties on purpose: a Staff
 * Engineer role is not "a slightly worse match" for someone two years in, it
 * is unreachable, and an additive penalty lets a strong keyword overlap drag
 * it back onto page one.
 */

export type Scored = {
  job: Job
  score: number
  /** Skill ids present in both the CV and the job. */
  overlap: string[]
  /** Skill ids the job asks for that the CV does not mention. */
  missing: string[]
  reasons: string[]
}

const SENIORITY_RANK: Record<Seniority, number> = {
  intern: 0,
  entry: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  unknown: 2,
}

/**
 * How well a job's level fits the candidate's. Reaching one level up is
 * normal and barely penalised; two levels up is a waste of an application.
 * Reaching down is penalised more gently, since an over-qualified applicant
 * still gets interviews.
 */
function seniorityGate(cv: Seniority, job: Seniority): number {
  if (job === 'unknown') return 0.92
  const gap = SENIORITY_RANK[job] - SENIORITY_RANK[cv]
  if (gap <= -2) return 0.55
  if (gap === -1) return 0.85
  if (gap === 0) return 1
  if (gap === 1) return 0.78
  if (gap === 2) return 0.3
  return 0.12
}

/**
 * Freshness.
 *
 * A month-old listing from a feed is often already filled, so it falls away
 * quickly. A listing read from the employer's own careers page is different:
 * it was confirmed live at the last refresh, so age says much less about it.
 * Those decay far more gently, and only really lose ground once the posting is
 * old enough to suggest a role nobody is urgently filling.
 */
function recencyGate(job: Job, now: number): number {
  const days = (now - Date.parse(job.posted)) / 86_400_000
  if (!Number.isFinite(days)) return 0.75

  if (job.direct) {
    const stale = (now - Date.parse(job.verified ?? job.posted)) / 86_400_000
    // Not seen on the board for over a week means the confirmation is old too.
    const confirmed = Number.isFinite(stale) && stale <= 7 ? 1 : 0.85
    if (days <= 14) return 1 * confirmed
    if (days <= 45) return 0.95 * confirmed
    if (days <= 120) return 0.85 * confirmed
    if (days <= 240) return 0.7 * confirmed
    return 0.55 * confirmed
  }

  if (days <= 3) return 1
  if (days <= 7) return 0.97
  if (days <= 14) return 0.9
  if (days <= 30) return 0.78
  if (days <= 60) return 0.55
  return 0.35
}

function skillScore(cvSkills: Set<string>, jobTags: string[]): { s: number; hit: string[]; miss: string[] } {
  if (!jobTags.length) return { s: 0, hit: [], miss: [] }
  let got = 0
  let total = 0
  const hit: string[] = []
  const miss: string[] = []

  for (const tag of jobTags) {
    const w = weightOf(tag)
    total += w
    if (cvSkills.has(tag)) {
      got += w
      hit.push(tag)
    } else {
      miss.push(tag)
    }
  }
  // Square-root so a job listing 12 technologies is not automatically a worse
  // match than one listing 3, purely for being descriptive.
  return { s: total > 0 ? Math.sqrt(got / total) : 0, hit, miss }
}

const STOP = new Set([
  'the','and','for','with','you','our','are','will','have','this','that','from','your','all','can',
  'has','was','not','but','they','their','who','what','out','use','using','work','working','team',
  'teams','role','job','position','company','we','a','an','to','of','in','on','at','is','as','be',
  'or','it','by','if','so','do','more','than','into','about','across','within','also','other',
])

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && w.length < 24 && !STOP.has(w))
}

/**
 * Title similarity, which carries a lot of weight because job titles are the
 * single most reliable indicator of whether a role is the same kind of work.
 */
function titleScore(cvTitles: string[], jobTitle: string): number {
  if (!cvTitles.length) return 0
  const jt = new Set(tokens(jobTitle))
  if (!jt.size) return 0

  let best = 0
  for (const t of cvTitles) {
    const ct = tokens(t)
    if (!ct.length) continue
    const shared = ct.filter((w) => jt.has(w)).length
    best = Math.max(best, shared / Math.max(ct.length, jt.size))
  }
  return best
}

/** Bag-of-words overlap between the CV and the job summary. */
function textScore(cvTokens: Set<string>, job: Job): number {
  const jt = tokens(`${job.title} ${job.summary}`)
  if (!jt.length) return 0
  const uniq = new Set(jt)
  let shared = 0
  for (const w of uniq) if (cvTokens.has(w)) shared++
  return shared / uniq.size
}

/**
 * Learned preference from hearted jobs.
 *
 * Deliberately inert until there are at least four likes. Three clicks is not
 * a signal, and letting it steer early produces a feedback loop where the list
 * narrows to whatever happened to be on top on day one.
 */
const MIN_LIKES = 4

function prefScore(prefs: Prefs, job: Job): number {
  const weights = prefs.weights
  if (prefs.liked.length < MIN_LIKES) return 0

  let sum = 0
  let n = 0
  for (const tag of job.tags) {
    const w = weights[tag]
    if (w !== undefined) {
      sum += w
      n++
    }
  }
  if (!n) return 0
  // Clamped so a strong preference nudges rather than dominates.
  return Math.max(-1, Math.min(1, sum / n))
}

export function scoreJob(job: Job, cv: CvProfile | null, prefs: Prefs, now: number): Scored {
  const reasons: string[] = []

  if (!cv) {
    // With no CV the list is ordered by freshness and listing quality alone,
    // which is honest: there is nothing yet to match against.
    const score = recencyGate(job, now) * (0.55 + 0.45 * job.quality)
    return { job, score, overlap: [], missing: job.tags, reasons: [] }
  }

  const cvSkills = new Set(cv.skills)
  const cvTokens = new Set(tokens(cv.text))

  const { s: skill, hit, miss } = skillScore(cvSkills, job.tags)
  const title = titleScore(cv.titles, job.title)
  const text = textScore(cvTokens, job)
  const pref = prefScore(prefs, job)

  const base = 0.44 * skill + 0.28 * title + 0.16 * text + 0.12 * job.quality
  const nudged = base * (1 + 0.22 * pref)
  const score = nudged * seniorityGate(cv.seniority, job.seniority) * recencyGate(job, now)

  if (hit.length >= 4) reasons.push(`${hit.length} skills in common`)
  else if (hit.length) reasons.push(`${hit.length} skill${hit.length > 1 ? 's' : ''} in common`)
  if (title > 0.5) reasons.push('title matches your experience')
  if (job.seniority === cv.seniority) reasons.push('right level for you')
  if (job.sponsor) reasons.push('employer sponsors visas')
  const days = (now - Date.parse(job.posted)) / 86_400_000
  if (days <= 2) reasons.push('posted in the last 48 hours')

  return { job, score, overlap: hit, missing: miss, reasons }
}

export function rank(jobs: Job[], cv: CvProfile | null, prefs: Prefs, now = Date.now()): Scored[] {
  const hidden = new Set(prefs.hidden)
  return jobs
    .filter((j) => !hidden.has(j.id))
    .map((j) => scoreJob(j, cv, prefs, now))
    .sort((a, b) => b.score - a.score)
}

/**
 * Rebuilds the preference weights from scratch on every like or dismiss.
 * Recomputing beats incrementing because it stays correct when a like is undone.
 */
export function learn(jobs: Job[], prefs: Prefs): Record<string, number> {
  const byId = new Map(jobs.map((j) => [j.id, j]))
  const liked = prefs.liked.map((id) => byId.get(id)).filter(Boolean) as Job[]
  const hidden = prefs.hidden.map((id) => byId.get(id)).filter(Boolean) as Job[]

  const counts: Record<string, { pos: number; neg: number }> = {}
  const bump = (tags: string[], key: 'pos' | 'neg') => {
    for (const t of tags) {
      counts[t] ??= { pos: 0, neg: 0 }
      counts[t][key]++
    }
  }
  liked.forEach((j) => bump(j.tags, 'pos'))
  hidden.forEach((j) => bump(j.tags, 'neg'))

  const weights: Record<string, number> = {}
  for (const [tag, { pos, neg }] of Object.entries(counts)) {
    const n = pos + neg
    // Smoothed toward zero so a single click cannot produce a full-strength
    // preference. At n=1 the magnitude is halved; it approaches 1 slowly.
    weights[tag] = ((pos - neg) / n) * (n / (n + 2))
  }
  return weights
}

/**
 * A stable daily selection. Seeded by the date so the homepage changes once a
 * day and shows the same set all day, rather than reshuffling on every reload.
 */
export function dailyPicks(scored: Scored[], seed: string, count = 6): Scored[] {
  if (scored.length <= count) return scored

  // Pick from the top slice rather than the whole list, so the daily rotation
  // stays genuinely relevant instead of surfacing the bottom of the barrel.
  const top = scored.slice(0, Math.max(count * 5, Math.ceil(scored.length * 0.25)))

  /* One company can easily hold several of the strongest matches, and a daily
     shortlist showing the same employer four times is close to useless. Only
     the best-scoring role per company enters the draw; if that leaves too few
     to choose from, the rest are added back. */
  const seen = new Set<string>()
  const pool: Scored[] = []
  const overflow: Scored[] = []
  for (const s of top) {
    const key = s.job.company.toLowerCase()
    if (seen.has(key)) overflow.push(s)
    else {
      seen.add(key)
      pool.push(s)
    }
  }
  while (pool.length < count && overflow.length) pool.push(overflow.shift() as Scored)

  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const rand = () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 100000) / 100000
  }

  const idx = pool.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx
    .slice(0, count)
    .sort((a, b) => a - b)
    .map((i) => pool[i])
}
