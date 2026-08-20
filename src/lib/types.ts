export type RemoteKind = 'remote' | 'hybrid' | 'onsite'
export type Seniority = 'intern' | 'entry' | 'mid' | 'senior' | 'lead' | 'unknown'

export type Salary = {
  min?: number
  max?: number
  currency?: string
  period?: 'year' | 'month' | 'day' | 'hour'
}

export type Job = {
  /** Fingerprint of company + title + location. Stable across sources and reposts. */
  id: string
  title: string
  company: string
  /**
   * ISO-2 codes. Empty means the location could not be resolved to a country,
   * which is NOT the same as being open to all of them — check `anywhere`.
   */
  countries: string[]
  /** True only when the posting itself says it is open anywhere. */
  anywhere?: boolean
  /** Human location string exactly as the employer wrote it. */
  location: string
  remote: RemoteKind
  seniority: Seniority
  /** ISO date the employer first published it. Can legitimately be months old. */
  posted: string
  /** ISO date this index first saw it, which is what "new" is measured from. */
  seen: string
  /**
   * ISO date this listing was last confirmed to still be live. For jobs read
   * straight from a company's own board this is meaningful: the role was on
   * their careers page on that date. Roles that disappear from a board have
   * been filled and are dropped.
   */
  verified: string
  /** True when read from the employer's own hiring system rather than a feed. */
  direct?: boolean
  url: string
  source: string
  salary?: Salary
  /** Skill tokens extracted from the description at build time. */
  tags: string[]
  /** Plain text, trimmed. Full text stays out of the index to keep it small. */
  summary: string
  /** True when the employer appears on an official government sponsor register. */
  sponsor?: boolean
  /** 0-1. Low scores mean the listing looks reposted, undated, or thin. */
  quality: number
}

export type IndexMeta = {
  generated: string
  total: number
  /** ISO-2 -> job count, for the globe. */
  byCountry: Record<string, number>
  bySource: Record<string, number>
  worldwide: number
}

export type CvProfile = {
  /** Raw extracted text. Never leaves the browser. */
  text: string
  fileName: string
  fileKind: 'pdf' | 'docx' | 'txt'
  words: number
  skills: string[]
  titles: string[]
  years: number | null
  seniority: Seniority
  /** Per-page text item positions, kept only for the layout checks. */
  layout?: LayoutSample[]
}

export type LayoutSample = {
  page: number
  width: number
  height: number
  items: { x: number; y: number; w: number; text: string }[]
}

export type Verdict = 'pass' | 'warn' | 'tip'

export type AtsCheck = {
  id: string
  label: string
  verdict: Verdict
  /** Shown under the label. Written as advice, never as a scold. */
  detail: string
  /** Only 'pass'/'warn' checks carry weight. Tips never reduce the score. */
  weight: number
}

export type AtsReport = {
  score: number
  band: 'clean' | 'good' | 'fixable' | 'rough'
  checks: AtsCheck[]
}

/**
 * Where a saved job has got to. `saved` is the resting state — set aside, not
 * acted on yet. Everything after it is a real step you took.
 */
export type AppStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected'

export type Application = {
  status: AppStatus
  /** ISO date the status last changed. */
  at: string
  /** ISO date the application went in, kept across later status changes. */
  appliedAt?: string
  /**
   * ISO date the employer's listing was last opened from here.
   *
   * Set the moment "Open listing" is tapped, because that is the last thing
   * that happens before you leave the site to fill in someone's form. Coming
   * back with the application sent and then having to find the row again to
   * mark it is how applications go unrecorded, so the tap records itself and
   * the card stays flagged until you confirm what came of it.
   */
  openedAt?: string
  note?: string
  /**
   * The listing as it was when you saved it.
   *
   * Without this the pipeline is a list of ids resolved against the live index,
   * and jobs leave that index constantly by design — removed when they come off
   * the employer's board, or dropped once the posting passes 90 days. That made
   * an application record disappear at exactly the moment it mattered most: the
   * role was filled and you needed to remember you had applied. Keeping a copy
   * also makes the backup file self-contained rather than a list of pointers.
   */
  job?: Job
}

export type Prefs = {
  saved: string[]
  liked: string[]
  hidden: string[]
  /** Job id to its place in the pipeline. Every key is also in `saved`. */
  applications: Record<string, Application>
  /** Learned token weights from likes. Only consulted once there are enough. */
  weights: Record<string, number>
  lastVisit: string | null
  countries: string[]
}
