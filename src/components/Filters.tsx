import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { RemoteKind, Seniority } from '@/lib/types'
import { COUNTRIES } from '@/data/countries'

export type FilterState = {
  query: string
  countries: string[]
  /** Include postings explicitly open to anywhere. */
  worldwide: boolean
  /** Last confirmed still on the employer's board within this many days. */
  maxDays: number
  /** First published by the employer within this many days. */
  maxPostedDays: number
  remote: RemoteKind[]
  levels: Seniority[]
  sponsorOnly: boolean
  sort: 'match' | 'new'
}

export const DEFAULT_FILTERS: FilterState = {
  query: '',
  countries: [],
  worldwide: true,
  maxDays: 30,
  maxPostedDays: 3650,
  remote: [],
  /*
   * Senior and Lead start off.
   *
   * They are 71% of the index — 1,303 of 1,843 — and they are the 71% a new
   * graduate cannot apply for, so leaving them on meant scrolling past four
   * unreachable roles for every reachable one. They are still one tap away
   * rather than removed, because the level is read off the posting's wording
   * and is sometimes wrong.
   */
  levels: ['intern', 'entry', 'mid', 'unknown'],
  sponsorOnly: false,
  sort: 'match',
}

const RECENCY = [
  { days: 1, label: '24 hours' },
  { days: 3, label: '3 days' },
  { days: 7, label: 'A week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: 'A month' },
  { days: 3650, label: 'Any time' },
]

const REMOTE: { value: RemoteKind; label: string }[] = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On site' },
]

const LEVELS: { value: Seniority; label: string }[] = [
  { value: 'intern', label: 'Intern' },
  { value: 'entry', label: 'Entry' },
  { value: 'mid', label: 'Mid' },
  // Listed because it is a fifth of the index and a good part of it is junior
  // work whose title simply never said so. Hiding it silently would drop those.
  { value: 'unknown', label: 'Unspecified' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
]

function sameSet<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x))
}

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

type Props = {
  value: FilterState
  onChange: (next: FilterState) => void
  counts: Record<string, number>
  total: number
  showing: number
}

export default function Filters({ value, onChange, counts, total, showing }: Props) {
  const [countrySearch, setCountrySearch] = useState('')
  const set = <K extends keyof FilterState>(key: K, v: FilterState[K]) =>
    onChange({ ...value, [key]: v })

  /** Only countries that actually have jobs, busiest first. */
  const available = useMemo(() => {
    const list = COUNTRIES.filter((c) => (counts[c.iso2] ?? 0) > 0)
    list.sort((a, b) => (counts[b.iso2] ?? 0) - (counts[a.iso2] ?? 0))
    if (!countrySearch.trim()) return list
    const q = countrySearch.toLowerCase()
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase() === q)
  }, [counts, countrySearch])

  const active =
    value.countries.length +
    value.remote.length +
    // Counted only when it differs from the default, which is itself a
    // selection — otherwise the panel would open claiming four active filters.
    (sameSet(value.levels, DEFAULT_FILTERS.levels) ? 0 : 1) +
    (value.sponsorOnly ? 1 : 0) +
    (value.maxDays !== DEFAULT_FILTERS.maxDays ? 1 : 0) +
    (value.maxPostedDays !== DEFAULT_FILTERS.maxPostedDays ? 1 : 0) +
    (value.query ? 1 : 0)

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
        <input
          type="search"
          value={value.query}
          onChange={(e) => set('query', e.target.value)}
          placeholder="Title, company or skill"
          className="w-full rounded-xl border border-line bg-abyss/70 py-2.5 pl-9 pr-3 text-sm text-chalk placeholder:text-dim focus:border-beam focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-dim">
          <span className="font-mono text-mist">{showing}</span> of{' '}
          <span className="font-mono">{total}</span> shown
        </p>
        {active > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTERS, sort: value.sort })}
            className="inline-flex items-center gap-1 text-xs text-sky hover:text-ice"
          >
            <X size={12} />
            Clear {active} filter{active > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Sort */}
      <div>
        <p className="label">Order by</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {(
            [
              ['match', 'Best match'],
              ['new', 'Newest first'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => set('sort', v)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors [@media(pointer:coarse)]:min-h-[44px] ${
                value.sort === v
                  ? 'border-beam/70 bg-beam/15 text-ice'
                  : 'border-line bg-deep/40 text-mist hover:border-haze'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Posted date. Deliberately first and separate: it answers "is this new?",
          which is the question the card's own "Posted 3 months ago" line invites,
          and which the confirmed-live chips below cannot answer. */}
      <div>
        <p className="label">Posted within</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RECENCY.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => set('maxPostedDays', r.days)}
              className={`chip ${value.maxPostedDays === r.days ? 'chip-on' : 'hover:border-haze'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-dim">
          When the employer first published the role. This is the date shown on each card.
        </p>
      </div>

      {/* Recency */}
      <div>
        <p className="label">Known live within</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RECENCY.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => set('maxDays', r.days)}
              className={`chip ${value.maxDays === r.days ? 'chip-on' : 'hover:border-haze'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-dim">
          For listings taken from a company's own careers page this is when the role was last seen
          still on it. For listings from a job feed there is no such signal, so it is the publish
          date.
        </p>
      </div>

      {/* Work mode */}
      <div>
        <p className="label">Work mode</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REMOTE.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => set('remote', toggleIn(value.remote, r.value))}
              className={`chip ${value.remote.includes(r.value) ? 'chip-on' : 'hover:border-haze'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Level */}
      <div>
        <p className="label">Level</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => set('levels', toggleIn(value.levels, l.value))}
              className={`chip ${value.levels.includes(l.value) ? 'chip-on' : 'hover:border-haze'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Visa */}
      <div>
        <p className="label">Visa</p>
        <button
          type="button"
          onClick={() => set('sponsorOnly', !value.sponsorOnly)}
          className={`chip mt-2 ${value.sponsorOnly ? 'border-amber/60 bg-amber/15 text-amber' : 'hover:border-haze'}`}
        >
          Only postings that mention sponsorship
        </button>
        <p className="mt-1.5 text-[11px] leading-relaxed text-dim">
          Matched on the employer's own wording — sponsorship or relocation support offered in the
          listing text. Postings that say they cannot sponsor are excluded. Silence is not counted
          either way, so this is a floor, not the full picture.
        </p>
      </div>

      {/* Countries */}
      <div>
        <div className="flex items-baseline justify-between">
          <p className="label">Country</p>
          {value.countries.length > 0 && (
            <button
              type="button"
              onClick={() => set('countries', [])}
              className="text-[11px] text-sky hover:text-ice"
            >
              Reset
            </button>
          )}
        </div>

        <label className="mt-2 flex items-center gap-2 rounded-lg border border-line/70 bg-deep/40 px-3 py-2">
          <input
            type="checkbox"
            checked={value.worldwide}
            onChange={(e) => set('worldwide', e.target.checked)}
            className="h-3.5 w-3.5 accent-beam"
          />
          <span className="text-xs text-mist">Include region-wide and worldwide roles</span>
        </label>
        <p className="mt-1 text-[11px] leading-relaxed text-dim">
          Roles advertised for a whole region — "Europe", "APAC" — rather than for a country. They
          may well be open where you are, but the employer did not name it.
        </p>

        <input
          type="search"
          value={countrySearch}
          onChange={(e) => setCountrySearch(e.target.value)}
          placeholder="Find a country"
          className="mt-2 w-full rounded-lg border border-line bg-abyss/70 px-3 py-2 text-xs text-chalk placeholder:text-dim focus:border-beam focus:outline-none"
        />

        <div className="thin-scroll mt-2 max-h-64 space-y-0.5 overflow-y-auto pr-1">
          {available.length === 0 && (
            <p className="px-1 py-3 text-xs text-dim">No countries match that.</p>
          )}
          {available.map((c) => {
            const on = value.countries.includes(c.iso2)
            return (
              <button
                key={c.iso2}
                type="button"
                onClick={() => set('countries', toggleIn(value.countries, c.iso2))}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors [@media(pointer:coarse)]:min-h-[44px] ${
                  on ? 'bg-beam/15 text-ice' : 'text-mist hover:bg-deep/60'
                }`}
              >
                <span className="w-6 shrink-0 font-mono text-[10px] tracking-wide text-dim">{c.iso2}</span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-dim">{counts[c.iso2]}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
