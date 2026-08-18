import { useCallback, useRef, useState } from 'react'
import { FileText, Loader2, Lock, RotateCcw, Upload } from 'lucide-react'
import type { CvProfile } from '@/lib/types'
import { parseCv } from '@/lib/cv'
import { labelOf } from '@/lib/skills'

type Props = {
  cv: CvProfile | null
  onCv: (cv: CvProfile | null) => void
  compact?: boolean
}

const SENIORITY_TEXT: Record<string, string> = {
  intern: 'internship level',
  entry: 'entry level',
  mid: 'mid level',
  senior: 'senior level',
  lead: 'lead level',
  unknown: 'level unclear',
}

export default function CvDrop({ cv, onCv, compact }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const handle = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      setError(null)
      setBusy(true)
      try {
        onCv(await parseCv(file))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That file could not be read.')
        onCv(null)
      } finally {
        setBusy(false)
      }
    },
    [onCv]
  )

  if (cv && compact) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line/70 bg-abyss/60 px-3 py-2.5">
        <FileText size={16} className="shrink-0 text-sky" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-chalk">{cv.fileName}</p>
          <p className="text-[11px] text-dim">
            {cv.skills.length} skills · {SENIORITY_TEXT[cv.seniority]}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onCv(null)
            if (input.current) input.current.value = ''
          }}
          className="shrink-0 rounded-lg border border-line p-1.5 text-dim transition-colors hover:border-haze hover:text-chalk"
          title="Remove and use a different CV"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    )
  }

  if (cv) {
    return (
      <div className="panel p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-beam/15 text-sky">
            <FileText size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-chalk">{cv.fileName}</p>
            <p className="mt-0.5 text-sm text-mist">
              {cv.words} words · {cv.skills.length} skills recognised ·{' '}
              {cv.years !== null ? `about ${cv.years} years of history` : 'no clear date range'} ·{' '}
              {SENIORITY_TEXT[cv.seniority]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onCv(null)
              if (input.current) input.current.value = ''
            }}
            className="btn-ghost !px-3 !py-1.5 !text-xs"
          >
            <RotateCcw size={13} />
            Change
          </button>
        </div>

        {cv.skills.length > 0 && (
          <div className="mt-4">
            <p className="label">What it found</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cv.skills.slice(0, 24).map((id) => (
                <span key={id} className="chip">
                  {labelOf(id)}
                </span>
              ))}
              {cv.skills.length > 24 && (
                <span className="chip border-transparent">+{cv.skills.length - 24} more</span>
              )}
            </div>
          </div>
        )}

        {cv.seniority === 'entry' && (
          <p className="mt-4 rounded-lg border border-line/60 bg-deep/40 p-3 text-xs leading-relaxed text-mist">
            Ranking is tuned to your level. Roles one step above yours still appear because they are
            worth a try; roles far above are pushed down rather than filling the page.
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void handle(e.dataTransfer.files?.[0])
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          over
            ? 'border-beam bg-beam/10'
            : 'border-line bg-abyss/40 hover:border-haze hover:bg-abyss/70'
        }`}
      >
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          className="sr-only"
          onChange={(e) => void handle(e.target.files?.[0])}
        />

        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-beam/15 text-sky">
          {busy ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
        </div>

        <p className="mt-3 font-semibold text-chalk">
          {busy ? 'Reading your CV…' : 'Drop your CV here'}
        </p>
        <p className="mt-1 text-sm text-mist">
          or click to choose a file — PDF, DOCX or TXT
        </p>

        <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-dim">
          <Lock size={11} />
          Read in this browser. It is never uploaded anywhere.
        </p>
      </label>

      {error && (
        <p className="mt-3 rounded-lg border border-rose/40 bg-rose/10 px-3 py-2 text-xs text-rose">
          {error}
        </p>
      )}
    </div>
  )
}
