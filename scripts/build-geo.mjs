/**
 * Turns the offline Natural Earth map (world-atlas, a devDependency) into the
 * two things the app needs at runtime:
 *
 *   public/data/globe.json     land dots + country centroids for the 3D globe
 *   src/data/countries.ts      ISO-2 / name / region lookup for filters
 *
 * Run once, or whenever the country list needs refreshing. The output is
 * committed, so the app has zero network dependency for geography — which is
 * what lets the globe render on GitHub Pages with no CDN and no API key.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import { geoContains, geoCentroid, geoArea } from 'd3-geo'
import countries from 'i18n-iso-countries'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))

const landTopo = read('node_modules/world-atlas/land-110m.json')
const ctryTopo = read('node_modules/world-atlas/countries-110m.json')

const land = feature(landTopo, landTopo.objects.land)
const ctry = feature(ctryTopo, ctryTopo.objects.countries)

/* ---------------------------------------------------------------- globe dots
 * A Fibonacci sphere gives near-uniform spacing with no polar bunching, which
 * is the whole reason the classic lat/lon grid globe looks wrong at the poles.
 * We keep only the points that fall on land.
 */
const N = 26000
const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const dots = []

for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = GOLDEN * i

  const lat = Math.asin(y) * (180 / Math.PI)
  let lon = Math.atan2(Math.sin(theta) * r, Math.cos(theta) * r) * (180 / Math.PI)
  if (lon > 180) lon -= 360
  if (lon < -180) lon += 360

  if (geoContains(land, [lon, lat])) {
    // Two decimals of a degree is ~1.1km — far finer than a 3px dot needs,
    // and it keeps the payload as compact integers.
    dots.push(Math.round(lon * 100), Math.round(lat * 100))
  }
}

/* ----------------------------------------------------------------- countries
 * world-atlas ids are UN M49 numeric codes. i18n-iso-countries maps those to
 * the ISO alpha-2 codes every job feed actually speaks.
 */
const REGION = {
  // Only the coarse buckets the UI groups by. Anything unmapped falls to ''.
  Europe: ['AL','AD','AT','BY','BE','BA','BG','HR','CY','CZ','DK','EE','FO','FI','FR','DE','GI','GR','GG','HU','IS','IE','IM','IT','JE','XK','LV','LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL','PT','RO','RU','SM','RS','SK','SI','ES','SJ','SE','CH','UA','GB','VA'],
  'North America': ['AG','BS','BB','BZ','BM','CA','CR','CU','DM','DO','SV','GL','GD','GT','HT','HN','JM','MX','NI','PA','PR','KN','LC','VC','TT','US'],
  'South America': ['AR','BO','BR','CL','CO','EC','FK','GF','GY','PY','PE','SR','UY','VE'],
  Asia: ['AF','AM','AZ','BH','BD','BT','BN','KH','CN','GE','HK','IN','ID','IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MO','MY','MV','MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK','SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE'],
  Africa: ['DZ','AO','BJ','BW','BF','BI','CM','CV','CF','TD','KM','CD','CG','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','EH','ZM','ZW'],
  Oceania: ['AS','AU','CK','FJ','PF','GU','KI','MH','FM','NR','NC','NZ','NU','NF','MP','PW','PG','WS','SB','TK','TO','TV','VU','WF'],
}
const regionOf = (iso2) => {
  for (const [name, list] of Object.entries(REGION)) if (list.includes(iso2)) return name
  return ''
}

/**
 * The official ISO names are correct but read badly in a dense list. These are
 * the forms people actually use.
 */
const SHORT = {
  US: 'United States',
  GB: 'United Kingdom',
  KR: 'South Korea',
  KP: 'North Korea',
  RU: 'Russia',
  IR: 'Iran',
  TZ: 'Tanzania',
  VN: 'Vietnam',
  TW: 'Taiwan',
  MD: 'Moldova',
  BO: 'Bolivia',
  VE: 'Venezuela',
  SY: 'Syria',
  LA: 'Laos',
  BN: 'Brunei',
  CD: 'DR Congo',
  CG: 'Congo',
  PS: 'Palestine',
  NL: 'Netherlands',
  MK: 'North Macedonia',
  CZ: 'Czechia',
  AE: 'UAE',
  CI: 'Ivory Coast',
  CV: 'Cape Verde',
  SZ: 'Eswatini',
  MM: 'Myanmar',
  BA: 'Bosnia and Herzegovina',
  DO: 'Dominican Republic',
  CF: 'Central African Republic',
}

const out = []
for (const f of ctry.features) {
  const numeric = String(f.id).padStart(3, '0')
  const iso2 = countries.numericToAlpha2(numeric)
  if (!iso2) continue

  const [lon, lat] = geoCentroid(f)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue

  out.push({
    iso2,
    name: SHORT[iso2] ?? countries.getName(iso2, 'en') ?? f.properties.name,
    lat: Math.round(lat * 100) / 100,
    lon: Math.round(lon * 100) / 100,
    // Steradians. Used to scale marker offsets so a marker on Russia does not
    // float a continent away from a marker on Singapore.
    area: Math.round(geoArea(f) * 10000) / 10000,
    region: regionOf(iso2),
  })
}
out.sort((a, b) => a.name.localeCompare(b.name))

/* Handful of hiring hubs Natural Earth 110m drops for being too small to draw,
 * but which absolutely appear in job feeds. Centroids are the capital. */
const EXTRA = [
  { iso2: 'SG', name: 'Singapore', lat: 1.35, lon: 103.82, area: 0.0001, region: 'Asia' },
  { iso2: 'HK', name: 'Hong Kong', lat: 22.32, lon: 114.17, area: 0.0001, region: 'Asia' },
  { iso2: 'MT', name: 'Malta', lat: 35.9, lon: 14.5, area: 0.0001, region: 'Europe' },
  { iso2: 'LU', name: 'Luxembourg', lat: 49.61, lon: 6.13, area: 0.0001, region: 'Europe' },
  { iso2: 'BH', name: 'Bahrain', lat: 26.07, lon: 50.56, area: 0.0001, region: 'Asia' },
  { iso2: 'MU', name: 'Mauritius', lat: -20.35, lon: 57.55, area: 0.0001, region: 'Africa' },
  { iso2: 'AD', name: 'Andorra', lat: 42.51, lon: 1.52, area: 0.0001, region: 'Europe' },
  { iso2: 'MC', name: 'Monaco', lat: 43.73, lon: 7.42, area: 0.0001, region: 'Europe' },
  { iso2: 'LI', name: 'Liechtenstein', lat: 47.17, lon: 9.51, area: 0.0001, region: 'Europe' },
]
for (const e of EXTRA) if (!out.some((c) => c.iso2 === e.iso2)) out.push(e)
out.sort((a, b) => a.name.localeCompare(b.name))

fs.mkdirSync(path.join(root, 'public/data'), { recursive: true })
// Only the land dots. Country positions reach the browser through
// src/data/countries.ts, which is bundled, so repeating them here would ship
// the same data twice.
fs.writeFileSync(path.join(root, 'public/data/globe.json'), JSON.stringify({ dots }))

// The collector runs in plain Node and needs the same country list.
fs.mkdirSync(path.join(root, 'pipeline/data'), { recursive: true })
fs.writeFileSync(path.join(root, 'pipeline/data/countries.json'), JSON.stringify(out))

fs.mkdirSync(path.join(root, 'src/data'), { recursive: true })
fs.writeFileSync(
  path.join(root, 'src/data/countries.ts'),
  `// GENERATED by scripts/build-geo.mjs — do not edit by hand.\n` +
    `export type Country = { iso2: string; name: string; lat: number; lon: number; area: number; region: string }\n` +
    `export const COUNTRIES: Country[] = ${JSON.stringify(out)}\n` +
    `export const BY_ISO2: Record<string, Country> = Object.fromEntries(COUNTRIES.map((c) => [c.iso2, c]))\n`
)

const kb = (n) => `${(n / 1024).toFixed(1)}kb`
console.log(`globe.json    ${dots.length / 2} land dots, ${out.length} countries  ${kb(fs.statSync(path.join(root, 'public/data/globe.json')).size)}`)
console.log(`countries.ts  ${out.length} entries  ${kb(fs.statSync(path.join(root, 'src/data/countries.ts')).size)}`)
