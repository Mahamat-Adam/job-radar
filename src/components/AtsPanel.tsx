import { useMemo } from 'react'
import { Check, Info, TriangleAlert } from 'lucide-react'
import type { AtsReport, CvProfile, Job } from '@/lib/types'
import { BAND_COPY, checkCv } from '@/lib/ats'

const BAND_TONE: Record<AtsReport['band'], { stroke: string; text: string }> = {
  clean: { stroke: '#34D399', text: 'text-mint' },
  good: { stroke: '#38D9E8', text: 'text-cyan' },
  fixable: { stroke: '#F6A723', text: 'text-amber' },
  rough: { stroke: '#FF6392', text: 'text-rose' },
}

const ICON = {
  pass: <Check size={14} className="text-mint" />,
  warn: <TriangleAlert size={14} className="text-amber" />,
  tip: <Info size={14} className="text-sky" />,
}

export default function AtsPanel({ cv, target }: { cv: CvProfile; target?: Job | null }) {
  const report = useMemo(() => checkCv(cv, target), [cv, target])
  const tone = BAND_TONE[report.band]
  const copy = BAND_COPY[report.band]

  const fixes = report.checks.filter((c) => c.verdict === 'warn')
  const passes = report.checks.filter((c) => c.verdict === 'pass')
  const tips = report.checks.filter((c) => c.verdict === 'tip')

  const r = 42
  const circ = 2 * Math.PI * r

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-col items-center gap-5 border-b border-line/60 p-6 sm:flex-row sm:items-start">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
            <circle cx="50" cy="50" r={r} fill="none" stroke="#12294F" strokeWidth="7" />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={tone.stroke}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - report.score / 100)}
              className="transition-[stroke-dashoffset] duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <span className={`font-display text-3xl font-bold ${tone.text}`}>{report.score}</span>
            <span className="text-[10px] uppercase tracking-widest text-dim">out of 100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h3 className={`font-display text-xl font-semibold ${tone.text}`}>{copy.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-mist">{copy.note}</p>
          <p className="mt-3 rounded-lg border border-line/60 bg-deep/40 p-3 text-xs leading-relaxed text-dim">
            This checks whether software can read your CV properly — not whether a recruiter will
            like it. The widespread claim that these systems auto-reject you on a keyword
            percentage does not reflect how the mainstream ones actually work: they are searchable
            databases, and a person runs the search. So the score below only counts things that
            genuinely break machine reading. Everything else is a suggestion and costs you nothing.
          </p>
        </div>
      </div>

      <div className="divide-y divide-line/40">
        {[...fixes, ...tips, ...passes].map((c) => (
          <div key={c.id} className="flex gap-3 px-6 py-3.5">
            <span className="mt-0.5 shrink-0">{ICON[c.verdict]}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-chalk">
                {c.label}
                {c.verdict === 'tip' && (
                  <span className="ml-2 rounded bg-deep px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dim">
                    Suggestion
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-mist">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {target && (
        <p className="border-t border-line/60 px-6 py-3 text-xs text-dim">
          Compared against <span className="text-mist">{target.title}</span> at{' '}
          <span className="text-mist">{target.company}</span>.
        </p>
      )}
    </div>
  )
}
