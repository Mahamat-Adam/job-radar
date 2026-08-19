/**
 * What belongs in the index.
 *
 * The feeds carry every kind of job. Keeping only what matches these patterns
 * is what makes the difference between a searchable index and a wall of noise.
 *
 * Turn a group on or off with the `on` flag. Adding a group here is the only
 * change needed to widen the net; the search terms sent to the keyword-based
 * feeds are derived from the same list.
 */

export const ROLE_GROUPS = [
  {
    id: 'web',
    on: true,
    label: 'Frontend and full-stack web',
    queries: ['frontend developer', 'full stack developer', 'react developer', 'javascript developer'],
    match: [
      /\b(?:front[- ]?end|frontend)\b.*\b(?:engineer|developer|dev)\b/i,
      /\b(?:full[- ]?stack)\b.*\b(?:engineer|developer|dev)\b/i,
      /\b(?:web)\s+(?:engineer|developer)\b/i,
      /\b(?:software|application)\s+(?:engineer|developer)\b/i,
      /\b(?:react|vue|angular|svelte|next\.?js|typescript|javascript|node\.?js)\b.*\b(?:engineer|developer)\b/i,
      /\b(?:ui)\s+(?:engineer|developer)\b/i,
    ],
  },
  {
    id: 'solutions',
    on: true,
    label: 'Solutions and technical consulting',
    queries: ['solutions engineer', 'sales engineer', 'technical consultant', 'implementation engineer'],
    match: [
      /\bsolutions?\s+(?:engineer|architect|consultant|specialist)\b/i,
      /\b(?:sales|pre[- ]?sales|field|forward[- ]deployed|partner|customer)\s+engineer\b/i,
      /\btechnical\s+(?:consultant|account manager|solutions? (?:manager|specialist)|architect)\b/i,
      /\b(?:implementation|integration|onboarding|deployment)\s+(?:engineer|specialist|consultant)\b/i,
      /\bsolution\s+design(?:er)?\b/i,
    ],
  },
  {
    id: 'automation',
    on: true,
    label: 'Automation, bots and scraping',
    queries: ['automation engineer', 'rpa developer', 'test automation engineer', 'sdet'],
    /**
     * The first version of these required the word immediately before the
     * noun, so "Business Automation Specialist" matched but "Engineer,
     * Automation Platform" did not. It found six jobs in a whole run. Allowing
     * the qualifier anywhere in the title is what these should have been.
     */
    match: [
      /\b(?:automation|rpa|robotic process)\b[^,]*\b(?:engineer|developer|specialist|analyst|consultant|architect)\b/i,
      // Bounded rather than comma-stopped: "Engineer, Automation Platform" is
      // a real and common title, and refusing to cross the comma missed it.
      /\b(?:engineer|developer|specialist)\b.{0,40}\b(?:automation|rpa)\b/i,
      /\bsdet\b/i,
      /\bsoftware (?:development )?engineer in test\b/i,
      /\b(?:qa|quality assurance|test)\b[^,]*\b(?:automation|engineer)\b/i,
      /\b(?:scraping|scraper|crawler|web data|data extraction)\b/i,
      /\b(?:workflow|process|business) automation\b/i,
    ],
  },
  {
    id: 'ai',
    on: true,
    label: 'AI and LLM engineering',
    queries: ['ai engineer', 'llm engineer', 'prompt engineer'],
    match: [
      /\b(?:ai|ml|llm|genai)\s+engineer\b/i,
      /\b(?:machine learning)\s+engineer\b/i,
      /\bprompt\s+engineer\b/i,
      /\bapplied\s+(?:ai|scientist)\b/i,
    ],
  },
  {
    id: 'data',
    on: true,
    label: 'Data and analytics',
    queries: ['data analyst', 'business intelligence developer'],
    match: [
      /\bdata\s+(?:analyst|engineer)\b/i,
      /\b(?:business intelligence|bi)\s+(?:developer|analyst|engineer)\b/i,
      /\banalytics\s+engineer\b/i,
    ],
  },
]

/** Titles that are never wanted, whatever else they match. */
const EXCLUDE = [
  /\b(?:sales|account)\s+(?:representative|executive|manager|director)\b/i,
  /\bbusiness development\b/i,
  /\brecruit(?:er|ment)\b/i,
  /\bmarketing\b/i,
  /\bcopywriter\b/i,
  /\bcustomer (?:support|success|service)\s+(?:agent|representative|advisor)\b/i,
  /\b(?:director|vp|vice president|head)\s+of\b/i,
  /\bchief\b/i,
  /\bintern(?:ship)?\b.*\bunpaid\b/i,
  /\bteacher\b|\btutor\b|\binstructor\b/i,
  /\bnurse\b|\bdriver\b|\bwarehouse\b|\bcleaner\b/i,
]

const ACTIVE = ROLE_GROUPS.filter((g) => g.on)

export const SEARCH_QUERIES = ACTIVE.flatMap((g) => g.queries)

export function isWanted(title) {
  const t = String(title ?? '')
  if (!t.trim()) return false
  if (EXCLUDE.some((re) => re.test(t))) return false
  return ACTIVE.some((g) => g.match.some((re) => re.test(t)))
}

/** Which enabled group a title belongs to, for the run summary. */
export function groupOf(title) {
  const t = String(title ?? '')
  for (const g of ACTIVE) if (g.match.some((re) => re.test(t))) return g.id
  return null
}
