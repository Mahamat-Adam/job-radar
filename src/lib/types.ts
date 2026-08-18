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
  /** ISO-2 codes. Empty means the posting is open worldwide. */
  countries: string[]
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

export type Prefs = {
  saved: string[]
  liked: string[]
  hidden: string[]
  /** Learned token weights from likes. Only consulted once there are enough. */
  weights: Record<string, number>
  lastVisit: string | null
  countries: string[]
}
