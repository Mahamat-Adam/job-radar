import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  AlertCircle,
  Bookmark,
  Compass,
  FileCheck2,
  Globe2,
  Heart,
  Layers,
  Lock,
  Clock,
  Download,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from 'lucide-react'
/*
 * Three.js is 120 KB gzipped and was a static import, which put it on the
 * render-blocking path: on throttled mobile the page showed nothing at all for
 * 3.2s while it downloaded. The globe is not what the first paint is for — at
 * 390px only its top ~216px is above the fold — so it loads on its own and the
 * page paints without it. The placeholder is the same aspect-square box, so
 * nothing moves when it arrives.
 */
const Globe = lazy(() => import('@/three/Globe'))

import { ErrorBoundary } from '@/components/ErrorBoundary'
import JobCard from '@/components/JobCard'
import CvDrop from '@/components/CvDrop'
import AtsPanel from '@/components/AtsPanel'
import Filters, { DEFAULT_FILTERS, type FilterState } from '@/components/Filters'
import { Reveal } from '@/components/Reveal'
import { STATUSES } from '@/components/StatusPicker'
import type { AppStatus, Application, CvProfile, Job, Prefs } from '@/lib/types'
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
  /** Saved tab: one pipeline stage shown alone, or null for all of them. */
  const [savedStage, setSavedStage] = useState<AppStatus | null>(null)
  /** Browse filter panel on a phone. Always open from lg up, where it is a column. */
  const [filtersOpen, setFiltersOpen] = useState(false)
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

  /** Bumped by "Try again", which is the only way to re-run the load. */
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let live = true
    loadIndex()
      .then((i) => live && setIndex(i))
      .catch((e: Error) => live && setLoadError(e.message))
    return () => {
      live = false
    }
  }, [loadAttempt])

  /* Tab switches land at the top of the new view. Scroll position used to
     carry across, so tapping Today from four thousand pixels down a Browse
     list opened Today four thousand pixels down as well — in the middle of a
     FAQ panel rather than at the picks. */
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view])

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
    (id: string, job?: Job) => setPrefs((p) => store.toggleSaved(p, id, job)),
    []
  )
  const onStatus = useCallback(
    (id: string, s: AppStatus) => setPrefs((p) => store.setStatus(p, id, s)),
    []
  )
  const onOpen = useCallback(
    (id: string, job?: Job) => setPrefs((p) => store.markOpened(p, id, job)),
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
      /* daysAgo floors, so `>=` is what makes "24 hours" mean a day rather than
         anything under 48. */
      if (daysAgo(freshness(job), now) >= filters.maxDays) return false
      if (daysAgo(job.posted, now) >= filters.maxPostedDays) return false
      if (filters.remote.length && !filters.remote.includes(job.remote)) return false
      if (filters.levels.length && !filters.levels.includes(job.seniority)) return false
      if (filters.sponsorOnly && !job.sponsor) return false

      if (filters.countries.length) {
        const hit = job.countries.some((c) => filters.countries.includes(c))
        /* Keyed off the posting's own words, never off an empty countries array:
           that array is also empty when the location simply could not be parsed,
           and those roles have a country, we just do not know which. */
        const openToAll = job.anywhere === true && filters.worldwide
        /* A posting that said only "Europe" carries eighteen country codes we
           expanded ourselves. Picking Switzerland should not quietly return it
           unless region-wide roles were asked for. */
        if (job.broad) {
          if (!hit || !filters.worldwide) return false
        } else if (!hit && !openToAll) {
          return false
        }
      } else if (!filters.worldwide && job.anywhere === true) {
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
      if (daysAgo(freshness(job), now) >= filters.maxDays) continue
      if (daysAgo(job.posted, now) >= filters.maxPostedDays) continue
      if (filters.remote.length && !filters.remote.includes(job.remote)) continue
      if (filters.levels.length && !filters.levels.includes(job.seniority)) continue
      if (filters.sponsorOnly && !job.sponsor) continue
      for (const c of job.countries) out[c] = (out[c] ?? 0) + 1
    }
    return out
  }, [
    ranked,
    filters.maxDays,
    filters.maxPostedDays,
    filters.remote,
    filters.levels,
    filters.sponsorOnly,
    now,
  ])

  /**
   * Independent of the Browse filters, with one exception: the country, because
   * the globe that sets it sits directly above these picks and tells you to tap
   * a marker to filter. Ignoring it there made the control look broken. Every
   * other filter still stays on Browse, so a daily selection does not quietly
   * shift because a seniority box was ticked on another screen.
   */
  const picks = useMemo(() => {
    const fresh = ranked.filter(({ job }) => {
      if (daysAgo(freshness(job), now) > 30) return false
      if (!filters.countries.length) return true
      const hit = job.countries.some((c) => filters.countries.includes(c))
      return hit || (job.anywhere === true && filters.worldwide)
    })
    return dailyPicks(fresh, todayKey(), 6)
  }, [ranked, now, filters.countries, filters.worldwide])

  /**
   * Saved jobs come from the live index where possible, and from the copy kept
   * at save time where not.
   *
   * Resolving purely against the index used to mean a tracked application
   * vanished the moment the role came off the employer's board or aged past the
   * cap — which is exactly when you most need the record. Anything no longer in
   * the index is still shown, marked as closed.
   */
  const savedItems = useMemo(() => {
    const live = new Map(ranked.map((s) => [s.job.id, s]))
    const out: { item: Scored; gone: boolean }[] = []

    for (const id of prefs.saved) {
      const hit = live.get(id)
      if (hit) {
        out.push({ item: hit, gone: false })
        continue
      }
      const snap = prefs.applications[id]?.job
      if (snap) {
        out.push({
          item: { job: snap, score: 0, overlap: [], missing: [], reasons: [] },
          gone: true,
        })
      }
      // A save made before snapshots existed, whose job has since left the
      // index, has nothing left to show. Nothing to render, nothing to lose.
    }
    return out
  }, [ranked, prefs.saved, prefs.applications])
  const likedItems = useMemo(
    () => ranked.filter((s) => prefs.liked.includes(s.job.id)),
    [ranked, prefs.liked]
  )

  const isNew = useCallback(
    (job: Job) => (sinceVisit ? Date.parse(job.seen) > Date.parse(sinceVisit) : false),
    [sinceVisit]
  )

  const hasCv = !!cv

  const renderCard = (item: Scored, gone = false) => (
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
      onOpen={onOpen}
      highlight={filters.countries}
      app={prefs.applications[item.job.id]}
      onStatus={onStatus}
      gone={gone}
    />
  )

  const worldwideCount = useMemo(
    () => ranked.filter((s) => s.job.anywhere === true).length,
    [ranked]
  )

  /* ---------------------------------------------------------------- view -- */

  return (
    <div className="min-h-dvh">
      <Header view={view} setView={setView} savedCount={prefs.saved.length} />

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-24 sm:px-6">
        {loadError && (
          <LoadError message={loadError} onRetry={() => {
              // Cleared here rather than inside the effect, so the retry is an
              // event doing one thing instead of a render cascade.
              setLoadError(null)
              setLoadAttempt((n) => n + 1)
            }} />
        )}

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
            {/* [&>*]:min-w-0 is load-bearing, the same way it is on the header
                nav. A grid item defaults to min-width:auto, so the single mobile
                column cannot shrink below its widest item's intrinsic minimum —
                and a job title set with `truncate` is white-space:nowrap, whose
                minimum is the entire untruncated line. One long title therefore
                widened the column to 575px inside a 393px phone, dragging the
                filter panel out with it and pushing the whole page sideways. */}
            <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[300px_1fr]">
              <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1 thin-scroll">
                {/* Closed by default on a phone. Left open, the panel is 72
                    controls and about 1,200px tall, so the first job sat two
                    full screenfuls down on every visit — and a swipe that began
                    inside the country list scrolled that list instead of the
                    page, which reads as the page being stuck. It is always open
                    from lg up, where it is a sticky column with room of its own. */}
                <button
                  type="button"
                  onClick={() => setFiltersOpen((o) => !o)}
                  aria-expanded={filtersOpen}
                  aria-controls="filter-panel"
                  className="btn-ghost mb-3 flex w-full items-center justify-between lg:hidden"
                >
                  <span className="inline-flex items-center gap-2">
                    <SlidersHorizontal size={15} />
                    Filters
                  </span>
                  <span className="text-xs font-normal text-dim">
                    {filtered.length.toLocaleString()} of {jobs.length.toLocaleString()}
                  </span>
                </button>

                <div
                  id="filter-panel"
                  className={`panel p-4 ${filtersOpen ? '' : 'hidden'} lg:block`}
                >
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
                    <div className="space-y-3">{filtered.slice(0, shown).map((it) => renderCard(it))}</div>

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
                title="Your pipeline"
                note="Everything you set aside, and where each one has got to. Stored in this browser only."
                count={savedItems.length}
              />

              {savedItems.length === 0 ? (
                <Empty
                  title="Nothing saved yet"
                  body="Bookmark a listing and it lands here, where you can track it from applied through to an offer."
                />
              ) : (
                <>
                  <Pipeline
                    items={savedItems.map((s) => s.item)}
                    apps={prefs.applications}
                    active={savedStage}
                    onSelect={setSavedStage}
                  />

                  {/* Grouped so the things needing action are not buried under
                      the ones already closed. */}
                  {STATUSES.map((s) => {
                    if (savedStage && s.value !== savedStage) return null
                    const group = savedItems.filter(
                      (it) => (prefs.applications[it.item.job.id]?.status ?? 'saved') === s.value
                    )
                    if (!group.length) return null
                    return (
                      <div key={s.value} className="mt-6">
                        <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dim">
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                          <span className="font-mono text-[11px] font-normal">{group.length}</span>
                        </p>
                        <div className="space-y-3">
                          {group.map((g) => renderCard(g.item, g.gone))}
                        </div>
                      </div>
                    )
                  })}
                </>
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
                <div className="mt-4 space-y-3">{likedItems.map((it) => renderCard(it))}</div>
              )}
            </div>

            <Backup prefs={prefs} onImport={setPrefs} />
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
    <header className="pt-safe sticky top-0 z-30 border-b border-line/50 bg-void/85 backdrop-blur-lg">
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
              className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors [@media(pointer:coarse)]:min-h-[44px] ${
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
          {/* Boundary as well as Suspense: a chunk that fails to download throws
              during render, and without this the whole page unmounted to a blank
              document. The globe is decoration — losing it should cost the globe
              and nothing else, since every country is also in the Browse filter. */}
          <ErrorBoundary label="globe" fallback={<GlobePlaceholder />}>
            <Suspense fallback={<GlobePlaceholder />}>
              <Globe
                counts={counts}
                selected={selected}
                onSelect={onCountry}
                className="mx-auto aspect-square w-full max-w-[520px]"
              />
            </Suspense>
          </ErrorBoundary>
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

/**
 * A count per stage, plus the one number that actually matters when you are
 * mid-hunt: how many applications are still waiting on a reply.
 */
function Pipeline({
  items,
  apps,
  active,
  onSelect,
}: {
  items: Scored[]
  apps: Record<string, Application>
  /** Stage currently being shown on its own, or null for all of them. */
  active: AppStatus | null
  onSelect: (s: AppStatus | null) => void
}) {
  const counts = STATUSES.map((s) => ({
    ...s,
    n: items.filter((it) => (apps[it.job.id]?.status ?? 'saved') === s.value).length,
  }))

  const waiting = items.filter((it) => {
    const a = apps[it.job.id]
    return a?.status === 'applied' && a.appliedAt && daysAgo(a.appliedAt) >= 14
  }).length

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {counts.map((s) => {
          const on = active === s.value
          return (
            <button
              key={s.value}
              type="button"
              // Clicking the stage you are already on clears it, so the same
              // control both narrows and restores without a separate reset.
              onClick={() => onSelect(on ? null : s.value)}
              disabled={s.n === 0 && !on}
              aria-pressed={on}
              title={
                s.n === 0
                  ? `Nothing at ${s.label.toLowerCase()} yet`
                  : on
                    ? 'Show every stage again'
                    : `Show only ${s.label.toLowerCase()}`
              }
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                on
                  ? 'border-beam/70 bg-beam/15'
                  : 'border-line/60 bg-abyss/50 enabled:hover:border-haze enabled:hover:bg-abyss/80'
              } disabled:cursor-not-allowed disabled:opacity-45`}
            >
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-dim">
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </p>
              <p
                className={`mt-0.5 font-display text-lg font-bold ${on ? 'text-ice' : 'text-chalk'}`}
              >
                {s.n}
              </p>
            </button>
          )
        })}
      </div>

      {waiting > 0 && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
          <Clock size={13} />
          {waiting} application{waiting > 1 ? 's have' : ' has'} had no reply for over two weeks.
        </p>
      )}
    </div>
  )
}

/**
 * Moving your pipeline between devices.
 *
 * There is no account, so nothing syncs on its own. A file you download and
 * re-open elsewhere is the honest version of that, and it also means a cleared
 * browser does not wipe months of tracking.
 */
function Backup({ prefs, onImport }: { prefs: Prefs; onImport: (p: Prefs) => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const download = () => {
    const blob = new Blob([store.exportPrefs(prefs)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-radar-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg({ ok: true, text: 'Downloaded.' })
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    try {
      const next = store.importPrefs(await file.text())
      onImport(next)
      setMsg({ ok: true, text: `Restored ${next.saved.length} saved and ${next.liked.length} liked.` })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'That file could not be read.' })
    }
  }

  const count = prefs.saved.length + prefs.liked.length

  return (
    <div className="panel p-5">
      <h3 className="font-display text-base font-semibold text-chalk">Move this to another device</h3>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-mist">
        Your pipeline lives in this browser, so it does not appear on your phone or survive
        clearing site data. Download a copy and open it on the other device to carry it across.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={download} disabled={count === 0} className="btn-ghost !text-xs">
          <Download size={13} />
          Download backup
        </button>

        <label className="btn-ghost cursor-pointer !text-xs">
          <Upload size={13} />
          Restore from file
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
      </div>

      {msg && (
        <p className={`mt-3 text-xs ${msg.ok ? 'text-mint' : 'text-rose'}`}>{msg.text}</p>
      )}
    </div>
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

/** Same box the globe occupies, so nothing shifts when it arrives or fails. */
function GlobePlaceholder() {
  return (
    <div
      aria-hidden
      className="mx-auto aspect-square w-full max-w-[520px] rounded-full border border-line/40 bg-abyss/30"
    />
  )
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber/40 bg-amber/10 p-4">
      <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber" />
      <div>
        <p className="text-sm font-semibold text-chalk">The job index could not be loaded</p>
        <p className="mt-1 text-xs text-mist">
          {message}. The rest of the page still works, including the CV check.
        </p>
        <button type="button" onClick={onRetry} className="btn-ghost mt-3 !px-3 !py-1.5 !text-xs">
          <RefreshCw size={13} />
          Try again
        </button>
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
