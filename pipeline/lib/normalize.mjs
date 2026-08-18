import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const here = path.dirname(fileURLToPath(import.meta.url))
const COUNTRIES = JSON.parse(fs.readFileSync(path.join(here, '../data/countries.json'), 'utf8'))

/* --------------------------------------------------------------- location -- */

/** Extra names and abbreviations that appear in job posts but not in ISO data. */
const ALIASES = {
  US: ['united states', 'usa', 'u.s.', 'u.s.a', 'america', 'stateside'],
  GB: ['united kingdom', 'uk', 'u.k.', 'britain', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'],
  AE: ['uae', 'u.a.e', 'united arab emirates', 'emirates'],
  KR: ['south korea', 'korea'],
  RU: ['russia'],
  CZ: ['czechia', 'czech republic'],
  NL: ['holland', 'the netherlands'],
  TR: ['turkiye', 'türkiye'],
  VN: ['viet nam'],
  CI: ["cote d'ivoire", 'ivory coast'],
  TW: ['taiwan'],
  HK: ['hong kong'],
  MO: ['macau', 'macao'],
  VA: ['vatican'],
  BO: ['bolivia'],
  VE: ['venezuela'],
  TZ: ['tanzania'],
  SY: ['syria'],
  IR: ['iran'],
  LA: ['laos'],
  MD: ['moldova'],
  BN: ['brunei'],
}

/** Major hiring cities, so "Berlin" resolves without the country being named. */
const CITIES = {
  US: ['new york', 'nyc', 'san francisco', 'bay area', 'seattle', 'austin', 'boston', 'chicago', 'los angeles', 'denver', 'atlanta', 'miami', 'dallas', 'houston', 'portland', 'san diego', 'philadelphia', 'phoenix', 'minneapolis', 'washington dc', 'brooklyn', 'palo alto', 'mountain view', 'san jose', 'salt lake city', 'raleigh', 'nashville', 'detroit'],
  GB: ['london', 'manchester', 'edinburgh', 'bristol', 'birmingham', 'leeds', 'glasgow', 'cambridge', 'oxford', 'brighton', 'cardiff', 'belfast'],
  DE: ['berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln', 'stuttgart', 'düsseldorf', 'leipzig'],
  NL: ['amsterdam', 'rotterdam', 'utrecht', 'eindhoven', 'the hague', 'den haag'],
  FR: ['paris', 'lyon', 'toulouse', 'bordeaux', 'marseille', 'lille', 'nantes'],
  ES: ['madrid', 'barcelona', 'valencia', 'seville', 'malaga', 'bilbao'],
  PT: ['lisbon', 'lisboa', 'porto', 'braga'],
  IE: ['dublin', 'cork', 'galway'],
  PL: ['warsaw', 'krakow', 'kraków', 'wroclaw', 'wrocław', 'gdansk', 'poznan'],
  SE: ['stockholm', 'gothenburg', 'göteborg', 'malmo', 'malmö'],
  NO: ['oslo', 'bergen'],
  DK: ['copenhagen', 'københavn', 'aarhus'],
  FI: ['helsinki', 'tampere', 'espoo'],
  CH: ['zurich', 'zürich', 'geneva', 'basel', 'lausanne', 'bern'],
  AT: ['vienna', 'wien', 'graz', 'linz'],
  BE: ['brussels', 'antwerp', 'ghent', 'leuven'],
  IT: ['milan', 'milano', 'rome', 'roma', 'turin', 'bologna', 'florence'],
  CZ: ['prague', 'praha', 'brno'],
  RO: ['bucharest', 'cluj', 'timisoara', 'iasi'],
  HU: ['budapest'],
  BG: ['sofia', 'plovdiv'],
  GR: ['athens', 'thessaloniki'],
  EE: ['tallinn', 'tartu'],
  LT: ['vilnius', 'kaunas'],
  LV: ['riga'],
  HR: ['zagreb', 'split'],
  RS: ['belgrade', 'novi sad'],
  UA: ['kyiv', 'kiev', 'lviv', 'kharkiv'],
  CA: ['toronto', 'vancouver', 'montreal', 'montréal', 'ottawa', 'calgary', 'waterloo', 'edmonton'],
  MX: ['mexico city', 'guadalajara', 'monterrey', 'cdmx'],
  BR: ['sao paulo', 'são paulo', 'rio de janeiro', 'belo horizonte', 'curitiba', 'porto alegre'],
  AR: ['buenos aires', 'cordoba', 'rosario'],
  CL: ['santiago'],
  CO: ['bogota', 'bogotá', 'medellin', 'medellín'],
  AU: ['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra'],
  NZ: ['auckland', 'wellington', 'christchurch'],
  SG: ['singapore'],
  MY: ['kuala lumpur', 'penang', 'cyberjaya', 'johor bahru', 'petaling jaya', 'selangor'],
  ID: ['jakarta', 'bandung', 'surabaya', 'bali'],
  TH: ['bangkok', 'chiang mai', 'phuket'],
  PH: ['manila', 'cebu', 'makati', 'taguig', 'quezon city'],
  VN: ['ho chi minh', 'hanoi', 'saigon', 'da nang'],
  IN: ['bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'pune', 'chennai', 'gurgaon', 'gurugram', 'noida', 'kolkata', 'ahmedabad'],
  PK: ['karachi', 'lahore', 'islamabad'],
  BD: ['dhaka'],
  LK: ['colombo'],
  JP: ['tokyo', 'osaka', 'kyoto', 'yokohama', 'fukuoka'],
  KR: ['seoul', 'busan'],
  CN: ['beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou'],
  HK: ['hong kong'],
  TW: ['taipei'],
  AE: ['dubai', 'abu dhabi', 'sharjah'],
  SA: ['riyadh', 'jeddah', 'dammam', 'khobar'],
  QA: ['doha'],
  KW: ['kuwait city'],
  BH: ['manama'],
  OM: ['muscat'],
  IL: ['tel aviv', 'jerusalem', 'haifa', 'herzliya'],
  TR: ['istanbul', 'ankara', 'izmir'],
  EG: ['cairo', 'alexandria', 'giza'],
  ZA: ['cape town', 'johannesburg', 'durban', 'pretoria'],
  NG: ['lagos', 'abuja'],
  KE: ['nairobi', 'mombasa'],
  GH: ['accra'],
  MA: ['casablanca', 'rabat', 'marrakech'],
  TN: ['tunis'],
  MU: ['port louis'],
}

/** Region words that mean "many countries", not one. */
const REGION_WORDS = {
  emea: ['GB', 'DE', 'NL', 'FR', 'ES', 'PL', 'IE', 'SE', 'PT', 'AE', 'ZA'],
  apac: ['SG', 'AU', 'JP', 'IN', 'MY', 'PH', 'ID', 'NZ', 'HK', 'TH', 'VN'],
  latam: ['BR', 'MX', 'AR', 'CO', 'CL'],
  europe: ['GB', 'DE', 'NL', 'FR', 'ES', 'PL', 'IE', 'SE', 'PT', 'IT', 'DK', 'FI', 'NO', 'CH', 'AT', 'BE', 'CZ', 'RO'],
  eu: ['DE', 'NL', 'FR', 'ES', 'PL', 'IE', 'SE', 'PT', 'IT', 'DK', 'FI', 'AT', 'BE', 'CZ', 'RO'],
  'north america': ['US', 'CA'],
  'united states': ['US'],
  americas: ['US', 'CA', 'BR', 'MX', 'AR'],
  'middle east': ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'IL'],
  africa: ['ZA', 'NG', 'KE', 'EG', 'GH', 'MA'],
  asia: ['SG', 'JP', 'IN', 'MY', 'PH', 'ID', 'TH', 'VN', 'HK'],
  'southeast asia': ['SG', 'MY', 'PH', 'ID', 'TH', 'VN'],
}

/** Phrases meaning the role is open to anyone anywhere. */
const ANYWHERE =
  /\b(?:worldwide|world ?wide|anywhere|global(?:ly)?|any location|any country|fully remote|remote,? global|100% remote|location[- ]independent|work from anywhere)\b/i

const NAME_INDEX = (() => {
  const idx = []
  for (const c of COUNTRIES) {
    idx.push({ iso2: c.iso2, form: c.name.toLowerCase() })
    // "Korea, Republic of" also appears as "Republic of Korea".
    if (c.name.includes(',')) {
      const flipped = c.name.split(',').map((s) => s.trim()).reverse().join(' ').toLowerCase()
      idx.push({ iso2: c.iso2, form: flipped })
    }
  }
  for (const [iso2, forms] of Object.entries(ALIASES)) {
    for (const f of forms) idx.push({ iso2, form: f })
  }
  for (const [iso2, forms] of Object.entries(CITIES)) {
    for (const f of forms) idx.push({ iso2, form: f })
  }
  // Longest first so "United States" is not eaten by "Stat".
  return idx.sort((a, b) => b.form.length - a.form.length)
})()

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function mentions(hay, form) {
  const left = /[a-z0-9]/.test(form[0]) ? '(?<![a-z0-9])' : ''
  const right = /[a-z0-9]/.test(form[form.length - 1]) ? '(?![a-z0-9])' : ''
  return new RegExp(`${left}${escape(form)}${right}`, 'i').test(hay)
}

/**
 * Resolves a free-text location to ISO-2 codes. An empty array means the
 * posting is open worldwide, which the UI treats as its own category rather
 * than as missing data.
 */
/**
 * Bare country codes, matched case-sensitively.
 *
 * "Remote - US" and "London (UK)" are extremely common, but adding "us" as a
 * lowercase alias would match the word "us" in ordinary prose such as "join
 * us". Requiring capitals makes these safe.
 */
const CODES = {
  US: /(?<![A-Za-z0-9])(?:US|USA)(?![A-Za-z0-9])/,
  GB: /(?<![A-Za-z0-9])UK(?![A-Za-z0-9])/,
  AE: /(?<![A-Za-z0-9])UAE(?![A-Za-z0-9])/,
  MY: /(?<![A-Za-z0-9])MY(?=\s*$)/,
  SG: /(?<![A-Za-z0-9])SG(?=\s*$)/,
  DE: /(?<![A-Za-z0-9])DE(?=\s*$)/,
  NL: /(?<![A-Za-z0-9])NL(?=\s*$)/,
  CA: /(?<![A-Za-z0-9])CAN(?![A-Za-z0-9])/,
}

function matchCodes(raw) {
  const out = []
  for (const [iso2, re] of Object.entries(CODES)) if (re.test(raw)) out.push(iso2)
  return out
}

export function toCountries(locationText) {
  const raw = String(locationText ?? '').trim()
  if (!raw) return []

  const hay = raw.toLowerCase()

  // "Remote - Anywhere" style. Checked first so it wins over a stray city.
  if (ANYWHERE.test(hay)) {
    // Unless it also names specific places, e.g. "Remote (Germany, Poland)".
    const named = [...new Set([...matchNames(hay), ...matchCodes(raw)])]
    return named.length ? named : []
  }

  const found = [...new Set([...matchNames(hay), ...matchCodes(raw)])]
  if (found.length) return found

  for (const [word, list] of Object.entries(REGION_WORDS)) {
    if (mentions(hay, word)) return list
  }
  return []
}

/**
 * Country names that are also US place names. "Atlanta, Georgia" is not the
 * country, and a job in "Lebanon, NH" is not in Lebanon. When the text carries
 * a US signal these are ignored, since the US match covers it.
 */
const US_COLLISIONS = new Set(['GE', 'LB', 'JO', 'MX'])
const US_SIGNAL =
  /\b(?:united states|usa|u\.s\.a?\b|,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b)/i

function matchNames(hay) {
  const out = new Set()
  const usContext = US_SIGNAL.test(hay)

  /* Matched text is blanked out as it is consumed. Without this, a longer form
     does not stop the shorter forms inside it from matching too, and
     "Northern Ireland" resolves to both the UK and Ireland. */
  let rest = hay

  for (const { iso2, form } of NAME_INDEX) {
    if (out.has(iso2)) continue

    const left = /[a-z0-9]/.test(form[0]) ? '(?<![a-z0-9])' : ''
    const right = /[a-z0-9]/.test(form[form.length - 1]) ? '(?![a-z0-9])' : ''
    const re = new RegExp(`${left}${escape(form)}${right}`, 'i')

    const m = re.exec(rest)
    if (!m) continue

    rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length)

    if (usContext && US_COLLISIONS.has(iso2)) continue
    out.add(iso2)
    if (out.size >= 8) break
  }

  // A US state abbreviation proves the country even when it is never named,
  // as in "Lebanon, NH".
  if (usContext) out.add('US')

  return [...out]
}

/* ----------------------------------------------------------------- remote -- */

export function toRemote(text, hint) {
  if (hint === true) return 'remote'
  const t = String(text ?? '').toLowerCase()
  if (/\bhybrid\b|\bpartially remote\b|\d\s*days?\s+(?:a week\s+)?(?:in|at)\s+(?:the\s+)?office/.test(t))
    return 'hybrid'
  if (/\bremote\b|\bwork from home\b|\bwfh\b|\bdistributed\b|\btelecommut/.test(t)) return 'remote'
  if (/\bon[- ]?site\b|\bin[- ]?office\b|\bin person\b/.test(t)) return 'onsite'
  return hint === false ? 'onsite' : 'onsite'
}

/* -------------------------------------------------------------- seniority -- */

export function toSeniority(title, description) {
  const t = String(title ?? '').toLowerCase()

  if (/\b(?:intern|internship|industrial training|placement student|working student)\b/.test(t))
    return 'intern'

  /**
   * "Staff" and "Principal" are levels above senior, and they are almost always
   * separated from the noun — "Staff Software Engineer", not "Staff Engineer".
   * Matching only the adjacent phrase let those titles through as unknown and
   * skip the seniority penalty entirely, which is exactly the failure that
   * fills an early-career candidate's list with unreachable roles.
   * `staffing` and `staff augmentation` are excluded.
   */
  if (
    /\b(?:head of|director|vp|vice president|chief|engineering manager|tech(?:nical)? lead|team lead|distinguished|fellow)\b/.test(t) ||
    /\bprincipal\b/.test(t) ||
    (/\bstaff\b/.test(t) && !/\bstaff(?:ing|ed)\b|\bstaff augmentation\b/.test(t))
  )
    return 'lead'

  if (/\b(?:senior|sr\.?|snr|lead)\b/.test(t)) return 'senior'
  if (/\b(?:junior|jr\.?|graduate|entry[- ]level|associate|trainee|apprentice|early career)\b/.test(t))
    return 'entry'
  if (/\b(?:ii|iii|3)\b/.test(t)) return 'mid'
  if (/\b(?:i|1)\b$/.test(t)) return 'entry'

  // Nothing in the title, so fall back to any stated experience requirement.
  const d = String(description ?? '').toLowerCase()
  const m = d.match(/\b(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*years?(?:'|’)?\s+(?:of\s+)?(?:relevant\s+|professional\s+|proven\s+|hands[- ]on\s+)?experience/)
  if (m) {
    const years = parseInt(m[1], 10)
    if (years >= 7) return 'senior'
    if (years >= 3) return 'mid'
    if (years >= 1) return 'entry'
    return 'entry'
  }
  return 'unknown'
}

/* ----------------------------------------------------------------- salary -- */

const CURRENCY = { $: 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR', 'RM': 'MYR', 'S$': 'SGD', 'A$': 'AUD' }

export function toSalary(text) {
  const t = String(text ?? '')
  if (!t) return undefined

  const m = t.match(
    /([$€£₹]|RM|S\$|A\$|USD|EUR|GBP|MYR|SGD|AUD|CAD)\s?([\d]{2,3}(?:[,.]\d{3})*|\d{2,6})\s*(k)?\s*(?:-|–|—|to)\s*([$€£₹]|RM|S\$|A\$)?\s?([\d]{2,3}(?:[,.]\d{3})*|\d{2,6})\s*(k)?/i
  )
  if (!m) return undefined

  const sym = m[1]
  const currency = CURRENCY[sym] ?? (/^[A-Z]{3}$/.test(sym) ? sym.toUpperCase() : undefined)
  const num = (s, k) => {
    const n = parseFloat(String(s).replace(/[,.](?=\d{3}\b)/g, ''))
    return k ? n * 1000 : n
  }
  const min = num(m[2], m[3])
  const max = num(m[5], m[6])
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return undefined
  // Reject obviously wrong reads such as a year range picked up as pay.
  if (min < 500 || max > 2_000_000) return undefined

  const period = /per hour|\/\s*hour|hourly|\/hr/i.test(t)
    ? 'hour'
    : /per month|\/\s*month|monthly|\/mo/i.test(t)
      ? 'month'
      : 'year'

  return { min, max, currency, period }
}

/* --------------------------------------------------------------- identity -- */

const NOISE = /\b(?:inc|llc|ltd|limited|gmbh|bv|b\.v|ab|as|oy|sa|s\.a|plc|corp|corporation|co|company|group|holdings|technologies|technology|labs|studio|studios|software|solutions|digital|global|international|the)\b/g

export const normCompany = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[.,'"()&]/g, ' ')
    .replace(NOISE, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim()

export const normTitle = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:m\/f\/d|f\/m\/d|m\/w\/d|all genders|remote|hybrid|onsite|full[- ]time|part[- ]time|contract|permanent)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Two postings are the same job when the same company advertises the same
 * role. Location is deliberately excluded: aggregators routinely split one
 * opening into a row per city, and those are duplicates, not options.
 */
export function fingerprint(company, title) {
  return crypto
    .createHash('sha1')
    .update(`${normCompany(company)}|${normTitle(title)}`)
    .digest('hex')
    .slice(0, 16)
}

/* ------------------------------------------------------------ sponsorship -- */

/**
 * The employer offering it, in their own words.
 *
 * Kept broad on purpose, because the negative patterns below override it. A
 * posting that raises the subject at all and does not rule it out is treated
 * as offering it.
 */
const SPONSOR_YES = new RegExp(
  [
    'visa sponsorship',
    'sponsorship (?:is |may be )?(?:available|provided|offered|possible)',
    '(?:offers?|offering|provides?|providing) (?:visa |work )?sponsorship',
    'we (?:can |will |do |also |happily )?sponsor',
    'will(?:ing to)? sponsor',
    'able to sponsor',
    'sponsor(?:ing)? (?:work )?(?:visas?|permits?)',
    'skilled worker visa',
    'tier 2 (?:visa|sponsor)',
    'h-?1b (?:sponsor|transfer|visa)',
    'employment pass',
    'work permit (?:provided|sponsored|support|sponsorship)',
    'relocation (?:package|assistance|support|bonus|help)',
    'we help(?: you)? relocate',
  ].join('|'),
  'i'
)

/** The employer ruling it out, which must win over any nearby positive. */
const SPONSOR_NO =
  /\b(?:no (?:visa )?sponsorship|unable to sponsor|cannot sponsor|not able to sponsor|do(?:es)? not (?:offer |provide )?sponsor|without (?:the need for )?sponsorship|must (?:already )?(?:have|possess) (?:the )?(?:right to work|valid work authoriz)|sponsorship (?:is )?not (?:available|offered|provided))/i

/**
 * Returns true only when the posting says sponsorship is on offer and does not
 * say elsewhere that it is not. Anything ambiguous returns false, because a
 * wrong badge here wastes an application.
 */
export function sponsorSignal(text) {
  const t = String(text ?? '')
  if (!t) return false
  if (SPONSOR_NO.test(t)) return false
  return SPONSOR_YES.test(t)
}

/* ---------------------------------------------------------------- quality -- */

const AGENCY =
  /\b(?:recruit|staffing|talent solutions|headhunt|manpower|consultancy services|outsourc|placement agency|rpo)\b/i

/**
 * Confidence that a listing is a real, current, directly-applicable opening.
 * Used to break ties and to drop the worst entries entirely.
 */
export function quality({ posted, url, description, source, company, direct }) {
  let q = 0.3

  if (posted && Number.isFinite(Date.parse(posted))) q += 0.25
  if (url && /^https?:\/\//.test(url)) q += 0.15
  const len = String(description ?? '').length
  if (len > 1200) q += 0.2
  else if (len > 400) q += 0.12
  else if (len > 150) q += 0.05
  // Straight from the employer's own careers system beats an aggregator copy.
  if (direct) q += 0.15
  if (AGENCY.test(String(company ?? '')) || AGENCY.test(String(source ?? ''))) q -= 0.2

  return Math.max(0, Math.min(1, q))
}

export function cleanTitle(s) {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—|]+|[\s\-–—|]+$/g, '')
    .trim()
    .slice(0, 140)
}

export function summarize(text, max = 320) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const stop = cut.lastIndexOf('. ')
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut).trim() + '…'
}
