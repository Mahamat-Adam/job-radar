import type { AppStatus, Application } from '@/lib/types'
import { agoLabel, daysAgo } from '@/lib/data'

export const STATUSES: { value: AppStatus; label: string; tone: string; dot: string }[] = [
  { value: 'saved', label: 'Saved', tone: 'border-line bg-deep/60 text-mist', dot: 'bg-dim' },
  { value: 'applied', label: 'Applied', tone: 'border-beam/60 bg-beam/15 text-sky', dot: 'bg-beam' },
  { value: 'interviewing', label: 'Interviewing', tone: 'border-cyan/60 bg-cyan/15 text-cyan', dot: 'bg-cyan' },
  { value: 'offer', label: 'Offer', tone: 'border-mint/60 bg-mint/15 text-mint', dot: 'bg-mint' },
  { value: 'rejected', label: 'Closed', tone: 'border-rose/40 bg-rose/10 text-rose', dot: 'bg-rose' },
]

export const STATUS_BY = Object.fromEntries(STATUSES.map((s) => [s.value, s]))

/**
 * How long an application has gone without an answer. Two weeks is the point
 * most people stop expecting one, so that is where it starts nudging.
 */
export function chaseHint(app: Application | undefined): string | null {
  if (!app || app.status !== 'applied' || !app.appliedAt) return null
  const d = daysAgo(app.appliedAt)
  if (d < 14) return null
  if (d < 28) return `No reply in ${d} days. Worth a follow-up.`
  return `No reply in ${d} days. Probably worth letting go.`
}

export default function StatusPicker({
  app,
  onChange,
}: {
  app: Application | undefined
  onChange: (s: AppStatus) => void
}) {
  const current = app?.status ?? 'saved'
  const hint = chaseHint(app)

  return (
    <div className="mt-3 border-t border-line/50 pt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-wider text-dim">
          Status
        </span>
        {STATUSES.map((s) => {
          const on = s.value === current
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange(s.value)}
              aria-pressed={on}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                on ? s.tone : 'border-line/70 text-dim hover:border-haze hover:text-mist'
              }`}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {app && app.status !== 'saved' && (
        <p className="mt-2 text-[11px] text-dim">
          {app.status === 'applied' && app.appliedAt
            ? `Applied ${agoLabel(app.appliedAt)}`
            : `Updated ${agoLabel(app.at)}`}
          {app.appliedAt && app.status !== 'applied' ? ` · applied ${agoLabel(app.appliedAt)}` : ''}
        </p>
      )}

      {hint && (
        <p className="mt-2 rounded-lg border border-amber/30 bg-amber/10 px-2.5 py-1.5 text-[11px] text-amber">
          {hint}
        </p>
      )}
    </div>
  )
}
