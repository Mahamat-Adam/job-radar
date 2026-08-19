/**
 * Finds which hiring system a company uses, and whether its public board
 * answers.
 *
 * Board tokens cannot be looked up in bulk anywhere, so this derives the
 * likely token from the company name and tries each system in turn, stopping
 * at the first hit. Everything runs one request at a time with a gap between
 * them — a burst of parallel requests looks like scraping to both the source
 * and to security software sitting in front of the machine.
 *
 *   node scripts/discover-boards.mjs            check every candidate
 *   node scripts/discover-boards.mjs --entry    only report boards that have
 *                                               junior-looking roles today
 *
 * Prints a block ready to paste into pipeline/companies.mjs.
 */
import { getJson } from '../pipeline/lib/http.mjs'
import { BOARDS } from '../pipeline/companies.mjs'

const ENTRY_ONLY = process.argv.includes('--entry')

/**
 * Weighted toward companies that actually hire early-career people: scale-ups,
 * developer tooling, and firms outside the US where a graduate intake is
 * normal. The big names already in companies.mjs are skipped automatically.
 */
const CANDIDATES = [
  // Developer tooling and infrastructure
  'Netlify', 'Render', 'Railway', 'Supabase', 'PlanetScale', 'Neon', 'Prisma',
  'Hasura', 'Apollo', 'Sentry', 'LogRocket', 'Honeycomb', 'Chronosphere',
  'CodeSandbox', 'StackBlitz', 'Gitpod', 'CircleCI', 'Buildkite', 'Harness',
  'LaunchDarkly', 'Statsig', 'Semgrep', 'Chainguard', 'Tailscale', 'Teleport',
  '1Password', 'Bitwarden', 'Doppler', 'Pulumi', 'Temporal', 'Cockroach Labs',
  'Timescale', 'ClickHouse', 'Redpanda', 'Confluent', 'Astronomer', 'Dagster',
  'Ably', 'Pusher', 'Algolia', 'Meilisearch', 'Typesense', 'Contentstack',
  'Sanity', 'Storyblok', 'Strapi', 'Directus', 'Payload',

  // SaaS and product companies
  'Loom', 'Calendly', 'Typeform', 'Hotjar', 'Mixpanel', 'Heap', 'Klaviyo',
  'Braze', 'Iterable', 'Attentive', 'Outreach', 'Gong', 'Clari', 'Highspot',
  'Seismic', 'Front', 'Help Scout', 'Gorgias', 'Freshworks', 'Zendesk',
  'Pipedrive', 'Copper', 'Close', 'Productboard', 'Pendo', 'Amplitude',
  'Miro', 'Mural', 'Lucid', 'Whimsical', 'Coda', 'Slab', 'Guru',

  // Fintech
  'Checkout.com', 'Rapyd', 'Airwallex', 'Revolut', 'Starling Bank', 'Bunq',
  'Pennylane', 'Spendesk', 'Payhawk', 'Marqeta', 'Modern Treasury', 'Mercury',
  'Remote', 'Oyster', 'Multiplier', 'Gusto', 'Wagestream', 'Zilch', 'Curve',
  'GoCardless', 'Form3', 'Thought Machine', 'Griffin', 'Yapily', 'TrueLayer',

  // Data and AI
  'Snowflake', 'dbt Labs', 'Fivetran', 'Airbyte', 'Census', 'Hightouch',
  'Monte Carlo', 'Weights and Biases', 'Hugging Face', 'Labelbox', 'Roboflow',
  'Cohere', 'Perplexity', 'Runway', 'ElevenLabs', 'Synthesia', 'AssemblyAI',
  'Deepgram', 'Pinecone', 'Weaviate', 'Together AI', 'Anyscale', 'LangChain',

  // Commerce, delivery and marketplaces
  'Shopify', 'BigCommerce', 'Faire', 'Depop', 'Vinted', 'Wolt', 'Glovo',
  'Rappi', 'Gopuff', 'Getir', 'Just Eat Takeaway', 'Zalando', 'HelloFresh',
  'Delivery Hero', 'Marley Spoon', 'Gousto', 'Ocado',

  // Travel and mobility
  'Omio', 'Trainline', 'Skyscanner', 'Hopper', 'TravelPerk', 'FlixBus',
  'Tier Mobility', 'Voi', 'Dott', 'Cabify',

  // Health
  'Ada Health', 'Kry', 'Oscar Health', 'Cedar', 'Zocdoc', 'Huma', 'Peppy',

  // Education and early-career friendly
  'Multiverse', 'Guild', 'Go1', 'Preply', 'Busuu', 'Quizlet', 'Brilliant',

  // Europe scale-ups
  'Celonis', 'Forto', 'sennder', 'Taxfix', 'Raisin', 'Solaris', 'Grover',
  'Choco', 'Ecosia', 'Trivago', 'Scalable Capital', 'Wefox', 'Bolt',
  'Truecaller', 'Kahoot', 'Cognite', 'Tink', 'Lunar', 'Templafy', 'Dixa',
  'Peakon', 'Zenjob', 'McMakler', 'Vay', 'Isar Aerospace',

  // Asia Pacific
  'Canva', 'SafetyCulture', 'Culture Amp', 'Linktree', 'Immutable', 'Deputy',
  'Employment Hero', 'Atlassian', 'Grab', 'Carousell', 'Ninja Van', 'Carsome',
  'StashAway', 'Xendit', 'Aspire', 'Coda Payments', 'Traveloka', 'Tokopedia',
  'Sleek', 'Osome', 'Endowus', 'Nium', 'Thunes', 'Advance Intelligence',

  // Middle East and Africa
  'Careem', 'Talabat', 'Property Finder', 'Tabby', 'Tamara', 'Swvl', 'Vezeeta',
  'Anghami', 'Kitopi', 'Trukker', 'Yassir', 'Flutterwave', 'Paystack', 'Chipper Cash',
  'Andela', 'Moniepoint', 'Kuda', 'M-KOPA', 'Wave',

  // Remote-first
  'Toggl', 'Doist', 'Buffer', 'Ghost', 'Hotjar', 'Aha', 'Zapier', 'Chili Piper',
  'Float', 'Teamwork', 'Workable', 'Kraken', 'Nubank', 'Wildbit',
]

/** Token guesses, most likely first. */
function slugs(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const dashed = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const firstWord = name.toLowerCase().split(/[^a-z0-9]+/)[0]
  return [...new Set([base, dashed, firstWord].filter(Boolean))]
}

const PROBES = [
  {
    ats: 'greenhouse',
    url: (t) => `https://boards-api.greenhouse.io/v1/boards/${t}/jobs`,
    count: (d) => (Array.isArray(d?.jobs) ? d.jobs.length : -1),
    titles: (d) => (d?.jobs ?? []).map((j) => j.title),
  },
  {
    ats: 'ashby',
    url: (t) => `https://api.ashbyhq.com/posting-api/job-board/${t}`,
    count: (d) => (Array.isArray(d?.jobs) ? d.jobs.length : -1),
    titles: (d) => (d?.jobs ?? []).map((j) => j.title),
  },
  {
    ats: 'lever',
    url: (t) => `https://api.lever.co/v0/postings/${t}?mode=json`,
    count: (d) => (Array.isArray(d) ? d.length : -1),
    titles: (d) => (Array.isArray(d) ? d : []).map((j) => j.text),
  },
]

const JUNIOR =
  /\b(junior|jr\.?|graduate|grad|entry[- ]level|associate|intern|internship|trainee|apprentice|early career|new grad|campus)\b/i

const known = new Set(BOARDS.map((b) => `${b.ats}:${b.token}`))
const knownNames = new Set(BOARDS.map((b) => b.name.toLowerCase()))

const found = []
let checked = 0

console.log(`Probing ${CANDIDATES.length} companies. One request at a time.\n`)

for (const name of CANDIDATES) {
  if (knownNames.has(name.toLowerCase())) continue

  let hit = null
  outer: for (const token of slugs(name)) {
    for (const probe of PROBES) {
      if (known.has(`${probe.ats}:${token}`)) continue
      checked++
      try {
        const data = await getJson(probe.url(token), { retries: 0, timeout: 15000 })
        const n = probe.count(data)
        if (n > 0) {
          const titles = probe.titles(data)
          hit = { name, ats: probe.ats, token, jobs: n, junior: titles.filter((t) => JUNIOR.test(t ?? '')).length }
          break outer
        }
      } catch {
        // 404 and the like are the expected answer for a wrong guess.
      }
    }
  }

  if (hit) {
    const keep = !ENTRY_ONLY || hit.junior > 0
    if (keep) {
      found.push(hit)
      console.log(`  HIT  ${hit.name.padEnd(24)} ${hit.ats.padEnd(11)} ${String(hit.jobs).padStart(4)} roles, ${hit.junior} junior`)
    }
  }
}

console.log(`\n${found.length} boards found from ${checked} requests.`)
console.log(`Total roles behind them: ${found.reduce((s, f) => s + f.jobs, 0)}`)
console.log(`Junior-looking roles:    ${found.reduce((s, f) => s + f.junior, 0)}\n`)

found.sort((a, b) => b.junior - a.junior || b.jobs - a.jobs)

console.log('--- paste into pipeline/companies.mjs ---')
for (const f of found) {
  console.log(`  { name: '${f.name.replace(/'/g, "\\'")}', ats: '${f.ats}', token: '${f.token}' },`)
}
