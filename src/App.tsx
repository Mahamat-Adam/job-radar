import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  AlertCircle,
  Bookmark,
  Compass,
  FileCheck2,
  Globe2,
  Heart,
  Layers,
  Lock,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import Globe from '@/three/Globe'
import JobCard from '@/components/JobCard'
import CvDrop from '@/components/CvDrop'
import AtsPanel from '@/components/AtsPanel'
import Filters, { DEFAULT_FILTERS, type FilterState } from '@/components/Filters'
import { Reveal } from '@/components/Reveal'
import type { CvProfile, Job, Prefs } from '@/lib/types'
import { agoLabel, daysAgo, freshness, loadIndex, type Index } from '@/lib/data'
import { dailyPicks, learn, rank, type Scored } from '@/lib/match'
import * as store from '@/lib/storage'

type View = 'discover' | 'browse' | 'saved' | 'cv'

const NAV: { id: View; label: string; icon: typeof Compass }[] = [
  { id: 'discover', label: 'Today', icon: Sparkles },
  { id: 'browse', label: 'Browse', icon: Layers },
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'cv', label: 'CV check', icon: FileCheck2 },
]

const todayKey = () => new Date().toISOString().slice(0, 10)

/** Results added per page in the Browse list. */
const PAGE = 30

export default function App() {
  const [index, setIndex] = useState<Index | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cv, setCv] = useState<CvProfile | null>(null)
  const [prefs, setPrefs] = useState<Prefs>(() => store.load())
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [view, setView] = useState<View>('discover')
  /**
   * How many results the Browse list has rendered. Putting all of them in the
   * DOM at once is thousands of nodes for a list nobody scrolls to the end of,
   * and it is felt immediately on a phone.
   */
  const [shown, setShown] = useState(PAGE)

  /* The visit stamp is read once at mount so the "new since last time" badges
     stay stable for the whole session instead of clearing as you browse. */
  const [sinceVisit] = useState(() => store.load().lastVisit)

  useEffect(() => {
    loadIndex()
      .then(setIndex)
      .catch((e: Error) => setLoadError(e.message))
  }, [])

  useEffect(() => {
    store.save({ ...prefs, lastVisit: new Date().toISOString() })
  }, [prefs])

  /* A new filter should start at the top of its own results, not part-way down
     a window the previous filter had expanded to. */
  useEffect(() => {
    setShown(PAGE)
  }, [filters])

  const jobs = index?.jobs ?? []
  /**
   * Fixed for the session. Taking Date.now() inline would give the ranking
   * memo a new dependency on every render and re-score the whole index each
   * time, and nothing here needs the clock to advance mid-visit.
   */
  const [now] = useState(() => Date.now())

  /* ------------------------------------------------------------- actions -- */

  const relearn = useCallback(
    (next: Prefs) => ({ ...next, weights: learn(jobs, next) }),
    [jobs]
  )

  const onSave = useCallback(
    (id: string) => setPrefs((p) => ({ ...p, saved: store.toggle(p.saved, id) })),
    []
  )
  const onLike = useCallback(
    (id: string) =>
      setPrefs((p) => relearn({ ...p, liked: store.toggle(p.liked, id), hidden: p.hidden.filter((x) => x !== id) })),
    [relearn]
  )
  const onHide = useCallback(
    (id: string) =>
      setPrefs((p) => relearn({ ...p, hidden: store.toggle(p.hidden, id), liked: p.liked.filter((x) => x !== id) })),
    [relearn]
  )
  const onCountry = useCallback((iso2: string) => {
    setFilters((f) => ({
      ...f,
      countries: f.countries.includes(iso2)
        ? f.countries.filter((c) => c !== iso2)
        : [...f.countries, iso2],
    }))
    setView('browse')
  }, [])

  /* ------------------------------------------------------------- ranking -- */

  const ranked = useMemo(() => rank(jobs, cv, prefs, now), [jobs, cv, prefs, now])

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase()

    let out = ranked.filter(({ job }) => {
      if (daysAgo(freshness(job), now) > filters.maxDays) return false
      if (filters.remote.length && !filters.remote.includes(job.remote)) return false
      if (filters.levels.length && !filters.levels.includes(job.seniority)) return false
      if (filters.sponsorOnly && !job.sponsor) return false

      if (filters.countries.length) {
        const hit = job.countries.some((c) => filters.countries.includes(c))
        const openToAll = job.countries.length === 0 && filters.worldwide
        if (!hit && !openToAll) return false
      } else if (!filters.worldwide && job.countries.length === 0) {
        return false
      }

      if (q) {
        const hay = `${job.title} ${job.company} ${job.tags.join(' ')} ${job.location}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    if (filters.sort === 'new') {
      out = [...out].sort((a, b) => Date.parse(b.job.posted) - Date.parse(a.job.posted))
    }
    return out
  }, [ranked, filters, now])

  /* Country counts reflect the current filters apart from country itself, so
     the globe answers "where are the jobs I would actually take". */
  const globeCounts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const { job } of ranked) {
      if (daysAgo(freshness(job), now) > filters.maxDays) continue
      if (filters.remote.length && !filters.remote.includes(job.remote)) continue
      if (filters.levels.length && !filters.levels.includes(job.seniority)) continue
      if (filters.sponsorOnly && !job.sponsor) continue
      for (const c of job.countries) out[c] = (out[c] ?? 0) + 1
    }
    return out
  }, [ranked, filters.maxDays, filters.remote, filters.levels, filters.sponsorOnly, now])

  /**
   * Deliberately independent of the Browse filters. A daily selection that
   * shifts because a country was ticked on another screen is not a daily
   * selection. Only freshness is applied.
   */
  const picks = useMemo(() => {
    const fresh = ranked.filter(({ job }) => daysAgo(freshness(job), now) <= 30)
    return dailyPicks(fresh, todayKey(), 6)
  }, [ranked, now])

  const savedItems = useMemo(
    () => ranked.filter((s) => prefs.saved.includes(s.job.id)),
    [ranked, prefs.saved]
  )
  const likedItems = useMemo(
    () => ranked.filter((s) => prefs.liked.includes(s.job.id)),
    [ranked, prefs.liked]
  )

  const isNew = useCallback(
    (job: Job) => (sinceVisit ? Date.parse(job.seen) > Date.parse(sinceVisit) : false),
    [sinceVisit]
  )

  const hasCv = !!cv

  const renderCard = (item: Scored) => (
    <JobCard
      key={item.job.id}
      item={item}
      hasCv={hasCv}
      saved={prefs.saved.includes(item.job.id)}
      liked={prefs.liked.includes(item.job.id)}
      isNew={isNew(item.job)}
      onSave={onSave}
      onLike={onLike}
      onHide={onHide}
    />
  )

  const worldwideCount = useMemo(
    () => ranked.filter((s) => s.job.countries.length === 0).length,
    [ranked]
  )

  /* ---------------------------------------------------------------- view -- */

  return (
    <div className="min-h-dvh">
      <Header view={view} setView={setView} savedCount={prefs.saved.length} />

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-24 sm:px-6">
        {loadError && <LoadError message={loadError} />}

        {view === 'discover' && (
          <Discover
            counts={globeCounts}
            selected={filters.countries}
            onCountry={onCountry}
            cv={cv}
            setCv={setCv}
            picks={picks}
            renderCard={renderCard}
            total={jobs.length}
            worldwide={worldwideCount}
            countryCount={Object.keys(globeCounts).length}
            generated={index?.meta.generated ?? null}
            setView={setView}
            ready={!!index}
          />
        )}

        {view === 'browse' && (
          <section className="pt-8">
            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
              <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1 thin-scroll">
                <div className="panel p-4">
                  <Filters
                    value={filters}
                    onChange={setFilters}
                    counts={globeCounts}
                    total={jobs.length}
                    showing={filtered.length}
                  />
                </div>
              </aside>

              <div>
                {cv ? (
                  <div className="mb-4">
                    <CvDrop cv={cv} onCv={setCv} compact />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setView('discover')}
                    className="mb-4 flex w-full items-center gap-3 rounded-xl border border-beam/30 bg-beam/10 px-4 py-3 text-left transition-colors hover:border-beam/60"
                  >
                    <Sparkles size={15} className="shrink-0 text-sky" />
                    <span className="text-xs text-mist">
                      <span className="font-semibold text-chalk">Add your CV</span> to rank these by
                      how well they fit you. Right now they are ordered by how recent they are.
                    </span>
                  </button>
                )}
                {filtered.length === 0 ? (
                  <Empty
                    title="Nothing matches those filters"
                    body="Try widening the date range or clearing a country."
                  />
                ) : (
                  <>
                    <div className="space-y-3">{filtered.slice(0, shown).map(renderCard)}</div>

                    {shown < filtered.length && (
                      <div className="mt-5 flex flex-col items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShown((n) => n + PAGE)}
                          className="btn-ghost w-full sm:w-auto"
                        >
                          Show {Math.min(PAGE, filtered.length - shown)} more
                        </button>
                        <p className="text-xs text-dim">
                          Showing {shown} of {filtered.length}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {view === 'saved' && (
          <section className="space-y-10 pt-8">
            <div>
              <SectionHead
                icon={Bookmark}
                title="Saved"
                note="Jobs you set aside. Stored in this browser only."
                count={savedItems.length}
              />
              {savedItems.length === 0 ? (
                <Empty
                  title="Nothing saved yet"
                  body="Use the bookmark button on any listing to keep it here."
                />
              ) : (
                <div className="mt-4 space-y-3">{savedItems.map(renderCard)}</div>
              )}
            </div>

            <div>
              <SectionHead
                icon={Heart}
                title="Liked"
                note={
                  prefs.liked.length < 4
                    ? `Like ${4 - prefs.liked.length} more and ranking starts leaning toward this kind of role.`
                    : 'Ranking now leans toward roles like these.'
                }
                count={likedItems.length}
              />
              {likedItems.length === 0 ? (
                <Empty
                  title="No likes yet"
                  body="The heart button teaches the ranking what you are actually after."
                />
              ) : (
                <div className="mt-4 space-y-3">{likedItems.map(renderCard)}</div>
              )}
            </div>
          </section>
        )}

        {view === 'cv' && (
          <section className="mx-auto max-w-3xl space-y-6 pt-8">
            <div>
              <h2 className="font-display text-2xl font-semibold text-chalk">Does your CV read cleanly?</h2>
              <p className="mt-2 text-sm leading-relaxed text-mist">
                Drop it in and this checks whether software can pull your details out properly. It
                stays in your browser.
              </p>
            </div>
            <CvDrop cv={cv} onCv={setCv} />
            {cv && <AtsPanel cv={cv} />}
          </section>
        )}
      </main>

      <Footer generated={index?.meta.generated ?? null} total={jobs.length} />
    </div>
  )
}

/* ------------------------------------------------------------------ parts -- */

function Header({
  view,
  setView,
  savedCount,
}: {
  view: View
  setView: (v: View) => void
  savedCount: number
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/50 bg-void/85 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-[1240px] items-center gap-4 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setView('discover')}
          className="flex shrink-0 items-center gap-2.5"
        >
          <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-beam/20">
            <Globe2 size={17} className="text-sky" />
            <span className="absolute inset-0 animate-pulse-ring rounded-lg border border-beam/50" />
          </span>
          <span className="font-display text-base font-bold tracking-tight text-chalk">
            Job Radar
          </span>
        </button>

        {/* min-w-0 is load-bearing: a flex item defaults to min-width:auto, so
            without it the nav refuses to shrink below its content and widens
            the whole page on a phone instead of scrolling inside itself. */}
        <nav className="thin-scroll ml-auto flex min-w-0 items-center gap-1 overflow-x-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                view === id ? 'bg-beam/15 text-ice' : 'text-mist hover:bg-deep/60 hover:text-chalk'
              }`}
            >
              <Icon size={14} />
              {label}
              {id === 'saved' && savedCount > 0 && (
                <span className="ml-0.5 rounded-full bg-amber/25 px-1.5 text-[10px] font-semibold text-amber">
                  {savedCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}

function Discover({
  counts,
  selected,
  onCountry,
  cv,
  setCv,
  picks,
  renderCard,
  total,
  worldwide,
  countryCount,
  generated,
  setView,
  ready,
}: {
  counts: Record<string, number>
  selected: string[]
  onCountry: (iso2: string) => void
  cv: CvProfile | null
  setCv: (cv: CvProfile | null) => void
  picks: Scored[]
  renderCard: (s: Scored) => ReactElement
  total: number
  worldwide: number
  countryCount: number
  generated: string | null
  setView: (v: View) => void
  ready: boolean
}) {
  return (
    <>
      {/* A column on phones and two columns from lg up, driven by order rather
          than by rendering the globe twice — a second Globe would mean a second
          WebGL context for something only one breakpoint can see.
          On a phone the reading order becomes headline, globe, then the CV drop,
          so the globe is on screen without scrolling past a form to reach it.
          Every child needs min-w-0: grid items default to min-width:auto and
          grow past their track to fit content, widening the whole page. */}
      <section className="flex flex-col gap-8 pt-10 lg:grid lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-10 lg:pt-14">
        <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
          <span className="chip border-beam/40 bg-beam/10 text-sky">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
            Refreshed daily
          </span>

          <h1 className="mt-4 font-display text-[2.1rem] font-bold leading-[1.08] tracking-tight text-chalk sm:text-5xl">
            Your CV, matched against
            <span className="block bg-gradient-to-r from-sky via-cyan to-sky bg-clip-text text-transparent">
              real jobs worldwide.
            </span>
          </h1>

          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mist">
            Drop in your CV and this reads it in your browser, then ranks openings by how well they
            actually fit you — your skills, your level, and how recently each one was posted. Filter
            by country on the globe, save the good ones, and check that your CV reads cleanly to the
            software employers put it through.
          </p>

          <ol className="mt-6 space-y-2.5">
            {[
              ['Drop your CV', 'It is read here in the page and never uploaded.'],
              ['Get ranked matches', 'Sorted by fit and freshness, not by who paid to be listed.'],
              ['Filter and save', 'Spin the globe to pick a country. Bookmark what looks worth it.'],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-beam/50 font-mono text-[10px] font-bold text-sky">
                  {i + 1}
                </span>
                <p className="text-sm text-mist">
                  <span className="font-semibold text-chalk">{title}.</span> {body}
                </p>
              </li>
            ))}
          </ol>

        </div>

        {/* Globe. Sits between the explanation and the upload on a phone, and
            fills the right-hand column across both rows on a wide screen. */}
        <div className="relative order-2 min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-beam/10 blur-3xl" />
          <Globe
            counts={counts}
            selected={selected}
            onSelect={onCountry}
            className="mx-auto aspect-square w-full max-w-[520px]"
          />
          <div className="mt-2 grid grid-cols-3 gap-3 text-center">
            <Stat value={total} label="openings" ready={ready} />
            <Stat value={countryCount} label="countries" ready={ready} />
            <Stat value={worldwide} label="remote anywhere" ready={ready} />
          </div>
          <p className="mt-3 text-center text-xs text-dim">
            Drag to spin. Tap a marker to filter to that country.
          </p>
        </div>

        <div className="order-3 min-w-0 lg:col-start-1 lg:row-start-2 lg:-mt-2">
          <div className="max-w-lg">
            <CvDrop cv={cv} onCv={setCv} />
          </div>
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-dim">
            <Lock size={12} />
            No account, no tracking, no server. Everything happens on your device.
          </p>
        </div>
      </section>

      {/* Daily picks */}
      <section className="pt-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-chalk">
              {cv ? "Today's picks for you" : "Today's picks"}
            </h2>
            <p className="mt-1 text-sm text-mist">
              {cv
                ? 'A fresh handful from your strongest matches. Changes once a day.'
                : 'A fresh handful each day. Add your CV and these become ranked by fit.'}
            </p>
          </div>
          <button type="button" onClick={() => setView('browse')} className="btn-ghost !py-2 !text-xs">
            See everything
          </button>
        </div>

        {picks.length === 0 ? (
          <div className="mt-4">
            <Empty
              title={ready ? 'No openings in the index yet' : 'Loading the index…'}
              body={
                ready
                  ? 'The daily collection has not run yet, or it found nothing. Once it runs, matches appear here.'
                  : 'One moment.'
              }
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {picks.map((item, i) => (
              // min-w-0: a grid item defaults to min-width:auto and will grow
              // past its track to fit its content's minimum, which pushes the
              // page sideways on a phone.
              <Reveal key={item.job.id} delay={Math.min(i, 5) * 0.06} className="min-w-0">
                {renderCard(item)}
              </Reveal>
            ))}
          </div>
        )}

        {generated && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-dim">
            <RefreshCw size={11} />
            Index last refreshed {agoLabel(generated)}
          </p>
        )}
      </section>

      <HowItWorks />
    </>
  )
}

/**
 * Written for someone who has never used the site and does not care how it is
 * built. Each panel answers a question a first-time visitor actually asks,
 * including the two that look like bugs until they are explained.
 */
function HowItWorks() {
  const panels = [
    {
      icon: Search,
      title: 'Where the jobs come from',
      body: 'Most of them are read straight off company careers pages — the same page you would land on if you applied directly. The rest come from open job boards that publish their listings freely. Nobody pays to appear here, so nothing is promoted.',
    },
    {
      icon: FileCheck2,
      title: 'How your CV is used',
      body: 'Your CV is opened and read by this page, in your browser, on your device. It is never sent anywhere, because there is nowhere to send it — this site has no server behind it. Close the tab and it is gone.',
    },
    {
      icon: Sparkles,
      title: 'How matching works',
      body: 'It looks for skills your CV and the job have in common, weighting unusual ones more heavily, then checks how close the job title is to work you have done, and whether the seniority actually fits. Rare skills count for more than common ones.',
    },
    {
      icon: Layers,
      title: 'Why your level matters',
      body: 'A job several grades above you is not a stretch, it is a wasted evening. Roles one step up still appear, because those are worth trying. Roles far above are pushed down rather than filling the page.',
    },
    {
      icon: RefreshCw,
      title: '"Posted 2 months ago · still listed today"',
      body: 'These mean different things. The first is when the employer published it. The second is that the role was still on their careers page at the last check. Companies leave good roles open for a long time, so an older posting can be perfectly live.',
    },
    {
      icon: Heart,
      title: 'Saving and hearting',
      body: 'The bookmark keeps a job for later. The heart teaches the ranking what you actually want, and starts having an effect after a handful of them. Both are stored on this device only, so they will not follow you to another phone.',
    },
  ]

  return (
    <section className="pt-16">
      <h2 className="font-display text-xl font-semibold text-chalk">How this works</h2>
      <p className="mt-1 text-sm text-mist">
        No accounts, no adverts, nothing sold on. Here is the whole thing in plain terms.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {panels.map(({ icon: Icon, title, body }, i) => (
          <Reveal key={title} delay={Math.min(i, 5) * 0.05} className="min-w-0">
            <div className="panel h-full p-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-beam/15 text-sky">
                <Icon size={15} />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-chalk">{title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-mist">{body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Stat({ value, label, ready }: { value: number; label: string; ready: boolean }) {
  return (
    <div className="rounded-xl border border-line/60 bg-abyss/50 px-2 py-2.5">
      <p className="font-display text-lg font-bold text-chalk">
        {ready ? value.toLocaleString() : '—'}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-dim">{label}</p>
    </div>
  )
}

function SectionHead({
  icon: Icon,
  title,
  note,
  count,
}: {
  icon: typeof Compass
  title: string
  note: string
  count: number
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-deep text-sky">
        <Icon size={15} />
      </span>
      <div>
        <h2 className="font-display text-xl font-semibold text-chalk">
          {title}
          <span className="ml-2 font-mono text-sm font-normal text-dim">{count}</span>
        </h2>
        <p className="mt-0.5 text-sm text-mist">{note}</p>
      </div>
    </div>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel px-6 py-12 text-center">
      <p className="font-display text-base font-semibold text-chalk">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-mist">{body}</p>
    </div>
  )
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber/40 bg-amber/10 p-4">
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber" />
      <div>
        <p className="text-sm font-semibold text-chalk">The job index could not be loaded</p>
        <p className="mt-1 text-xs text-mist">
          {message}. The rest of the page still works, including the CV check.
        </p>
      </div>
    </div>
  )
}

function Footer({ generated, total }: { generated: string | null; total: number }) {
  return (
    <footer className="border-t border-line/50 bg-abyss/40">
      <div className="mx-auto grid w-full max-w-[1240px] gap-6 px-4 py-8 text-xs text-dim sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-display text-sm font-semibold text-mist">Job Radar</p>
          <p className="mt-1.5 leading-relaxed">
            A personal job search tool. No accounts, no adverts, nothing sold on.
          </p>
        </div>
        <div>
          <p className="font-semibold text-mist">Where the jobs come from</p>
          <p className="mt-1.5 leading-relaxed">
            Collected daily from public job feeds and company career pages. Every listing links
            straight to the employer.
          </p>
        </div>
        <div>
          <p className="font-semibold text-mist">Freshness</p>
          <p className="mt-1.5 leading-relaxed">
            {total.toLocaleString()} openings in the index
            {generated ? `, last refreshed ${agoLabel(generated)}` : ''}. Listings older than a
            month are dropped.
          </p>
        </div>
      </div>
    </footer>
  )
}
