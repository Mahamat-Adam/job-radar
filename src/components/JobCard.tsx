import { memo } from 'react'
import { Bookmark, Heart, ExternalLink, EyeOff, MapPin, ShieldCheck } from 'lucide-react'
import type { Scored } from '@/lib/match'
import type { AppStatus, Application, Job } from '@/lib/types'
import StatusPicker from '@/components/StatusPicker'
import { agoLabel, salaryLabel } from '@/lib/data'
import { openExternal } from '@/lib/openExternal'
import { labelOf } from '@/lib/skills'
import { BY_ISO2 } from '@/data/countries'

type Props = {
  item: Scored
  saved: boolean
  liked: boolean
  hasCv: boolean
  isNew: boolean
  onSave: (id: string, job?: Job) => void
  onLike: (id: string) => void
  onHide: (id: string) => void
  /** Fired as the employer's listing is opened, before the tab leaves. */
  onOpen: (id: string, job?: Job) => void
  /** Present only when the job is saved; drives the pipeline control. */
  app?: Application
  onStatus?: (id: string, s: AppStatus) => void
  /** The listing has left the index; shown from the copy kept at save time. */
  gone?: boolean
}

const REMOTE_STYLE: Record<string, string> = {
  remote: 'border-mint/40 bg-mint/10 text-mint',
  hybrid: 'border-cyan/40 bg-cyan/10 text-cyan',
  onsite: 'border-line bg-deep/60 text-mist',
}

const SENIORITY_LABEL: Record<string, string> = {
  intern: 'Internship',
  entry: 'Entry level',
  mid: 'Mid level',
  senior: 'Senior',
  lead: 'Lead',
  unknown: '',
}

function scoreTone(score: number) {
  if (score >= 0.62) return { ring: '#34D399', text: 'text-mint' }
  if (score >= 0.42) return { ring: '#38D9E8', text: 'text-cyan' }
  if (score >= 0.24) return { ring: '#60A5FA', text: 'text-sky' }
  return { ring: '#61789B', text: 'text-dim' }
}

function MatchRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(score * 100)))
  const tone = scoreTone(score)
  const r = 17
  const circ = 2 * Math.PI * r

  return (
    <div className="relative h-11 w-11 shrink-0" title={`Match strength ${pct} out of 100`}>
      <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#12294F" strokeWidth="3.5" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={tone.ring}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span
        className={`absolute inset-0 grid place-items-center font-mono text-[11px] font-semibold ${tone.text}`}
      >
        {pct}
      </span>
    </div>
  )
}

function JobCardBase({
  item,
  saved,
  liked,
  hasCv,
  isNew,
  onSave,
  onLike,
  onHide,
  onOpen,
  app,
  onStatus,
  gone,
}: Props) {
  const { job, overlap, reasons } = item
  const pay = salaryLabel(job)
  const tone = scoreTone(item.score)

  const places = job.countries.length
    ? job.countries.slice(0, 3).map((c) => ({ iso2: c, name: BY_ISO2[c]?.name ?? c }))
    : []

  /*
   * Three states, readable at a glance while scrolling.
   *
   *  green   the application went in, or has moved past that
   *  amber   you opened the employer's listing and never said what happened,
   *          so it is either waiting to be confirmed or was abandoned
   *  normal  untouched
   *
   * Amber deliberately outranks nothing: it only shows while the question is
   * still open, and answering it either way clears it.
   */
  const applied =
    app?.status === 'applied' || app?.status === 'interviewing' || app?.status === 'offer'
  const awaitingConfirmation = !applied && app?.status !== 'rejected' && !!app?.openedAt

  const shell = applied
    ? 'border-mint/50 bg-mint/[0.06] hover:border-mint/70'
    : awaitingConfirmation
      ? 'border-amber/50 bg-amber/[0.06] hover:border-amber/70'
      : 'border-line/70 bg-abyss/55 hover:border-haze hover:bg-abyss/80'

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 ${shell}`}
    >
      {/* Left accent encodes match strength without needing to read the number. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] opacity-70 transition-opacity group-hover:opacity-100"
        style={{ background: tone.ring }}
      />

      <div className="flex gap-4 p-4 pl-5 sm:p-5 sm:pl-6">
        {hasCv && <MatchRing score={item.score} />}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0">
              {/* Clamped rather than truncated. On a phone the column is ~320px
                  and plenty of real titles run past 400px, so a single line cut
                  "Staff Software Engineer - Customer Identity…" down to
                  something you cannot judge. Two lines then an ellipsis keeps
                  the card compact and still says what the job is. */}
              <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-chalk">
                {job.title}
              </h3>
              <p className="mt-0.5 truncate text-sm text-mist">{job.company}</p>
            </div>

            {gone ? (
              <span
                className="shrink-0 rounded-full bg-dim/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-dim"
                title="This listing has come off the employer's board or aged out. Your record of it is kept."
              >
                No longer listed
              </span>
            ) : (
              isNew && (
                <span className="shrink-0 rounded-full bg-beam/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky">
                  New
                </span>
              )
            )}
          </div>

          {/* Facts row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-dim">
            <span className={`chip ${REMOTE_STYLE[job.remote]}`}>
              {job.remote === 'remote' ? 'Remote' : job.remote === 'hybrid' ? 'Hybrid' : 'On site'}
            </span>

            {SENIORITY_LABEL[job.seniority] && (
              <span className="chip">{SENIORITY_LABEL[job.seniority]}</span>
            )}

            {job.sponsor && (
              <span
                className="chip border-amber/40 bg-amber/10 text-amber"
                title="This posting explicitly mentions visa sponsorship or relocation support"
              >
                <ShieldCheck size={12} />
                Mentions sponsorship
              </span>
            )}

            {pay && <span className="chip border-mint/30 text-mint">{pay}</span>}
          </div>

          {/* Location and date */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dim">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={12} className="shrink-0" />
              {places.length ? (
                <span className="truncate">
                  {places.map((p) => p.name).join(' · ')}
                  {job.countries.length > 3 && ` +${job.countries.length - 3}`}
                </span>
              ) : job.anywhere ? (
                <span>Remote, anywhere</span>
              ) : (
                /* Country unresolved. The employer's own wording is honest;
                   claiming "anywhere" for a listing that says "Hybrid" is not. */
                <span className="truncate">{job.location}</span>
              )}
            </span>
            <span aria-hidden className="text-line">|</span>
            <time dateTime={job.posted}>Posted {agoLabel(job.posted)}</time>

            {job.direct && job.verified && (
              <>
                <span aria-hidden className="text-line">|</span>
                <span
                  className="inline-flex items-center gap-1 text-mint"
                  title="This role was still on the employer's own careers page at the last refresh"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                  Still listed {agoLabel(job.verified)}
                </span>
              </>
            )}

            <span aria-hidden className="text-line">|</span>
            <span className="font-mono text-[11px] opacity-70">{job.source}</span>
          </div>

          {/* Why it matched */}
          {hasCv && reasons.length > 0 && (
            <p className="mt-2.5 text-xs text-mist">
              <span className={tone.text}>Why: </span>
              {reasons.join(' · ')}
            </p>
          )}

          {/* Skills you already have */}
          {overlap.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {overlap.slice(0, 8).map((id) => (
                <span
                  key={id}
                  className="rounded-md bg-beam/15 px-1.5 py-0.5 text-[11px] font-medium text-ice"
                >
                  {labelOf(id)}
                </span>
              ))}
              {overlap.length > 8 && (
                <span className="px-1 py-0.5 text-[11px] text-dim">+{overlap.length - 8}</span>
              )}
            </div>
          )}

          {job.summary && (
            <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-dim">{job.summary}</p>
          )}

          {/* The open question, answerable in one tap without hunting for the
              status control. Left unanswered it simply stays, which is the
              honest record of a listing you opened and did not apply to. */}
          {awaitingConfirmation && onStatus && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-amber/40 bg-amber/[0.07] px-2.5 py-2">
              <span className="text-[11px] text-amber">
                Opened {agoLabel(app.openedAt as string)} — did you apply?
              </span>
              <button
                type="button"
                onClick={() => onStatus(job.id, 'applied')}
                className="rounded-md border border-amber/60 bg-amber/20 px-2 py-0.5 text-[11px] font-semibold text-amber transition-colors hover:bg-amber/30"
              >
                Yes, applied
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="mt-3.5 flex items-center gap-1.5">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                // Recorded before the tab leaves, so the job is already filed
                // by the time you are looking at somebody's application form.
                onOpen(job.id, job)
                openExternal(e, job.url)
              }}
              className="btn-primary !px-3 !py-1.5 !text-xs"
            >
              Open listing
              <ExternalLink size={13} />
            </a>

            <button
              type="button"
              onClick={() => onSave(job.id, job)}
              aria-pressed={saved}
              title={saved ? 'Remove from saved' : 'Save this job'}
              className={`rounded-lg border p-2 transition-colors ${
                saved
                  ? 'border-amber/50 bg-amber/15 text-amber'
                  : 'border-line text-dim hover:border-haze hover:text-mist'
              }`}
            >
              <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
            </button>

            <button
              type="button"
              onClick={() => onLike(job.id)}
              aria-pressed={liked}
              title={liked ? 'Stop favouring this kind of job' : 'Show me more like this'}
              className={`rounded-lg border p-2 transition-colors ${
                liked
                  ? 'border-rose/50 bg-rose/15 text-rose'
                  : 'border-line text-dim hover:border-haze hover:text-mist'
              }`}
            >
              <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
            </button>

            <button
              type="button"
              onClick={() => onHide(job.id)}
              title="Hide this one and show fewer like it"
              className="ml-auto rounded-lg border border-transparent p-2 text-dim opacity-0 transition-all hover:border-line hover:text-mist focus-visible:opacity-100 group-hover:opacity-100"
            >
              <EyeOff size={14} />
            </button>
          </div>

          {/* Only once a job is saved. Showing a pipeline control on every
              listing in a thousand-row list would be noise. */}
          {saved && onStatus && <StatusPicker app={app} onChange={(s) => onStatus(job.id, s)} />}
        </div>
      </div>
    </article>
  )
}

export default memo(JobCardBase)
