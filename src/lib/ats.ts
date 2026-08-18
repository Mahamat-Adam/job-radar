import type { AtsCheck, AtsReport, CvProfile, Job } from './types'
import { labelOf, weightOf } from './skills'

/**
 * A deliberately forgiving CV parseability check.
 *
 * The premise most paid tools sell — that applicant tracking systems reject
 * you on a keyword percentage — is not how the mainstream systems work. They
 * are databases with search over them; a recruiter runs the query. So this
 * checks the thing that actually costs you: whether a machine can read the
 * file at all and get your details out of it intact.
 *
 * Only checks that affect machine reading carry weight. Everything else is
 * offered as a tip and cannot lower the score.
 */

const SECTION_WORDS = [
  ['experience', /\b(?:work\s+)?experience\b|\bemployment\b|\bcareer history\b|\bprofessional background\b/i],
  ['education', /\beducation\b|\bacademic\b|\bqualifications?\b/i],
  ['skills', /\bskills?\b|\btechnical (?:skills|proficienc)|\bcompetenc/i],
] as const

function has(text: string, re: RegExp) {
  return re.test(text)
}

/**
 * Detects a genuine running header or footer — the thing some parsers skip.
 *
 * Position alone cannot tell you this. On a one-page CV the name and contact
 * line sit at the very top of the page because that is where they belong, and
 * a check that flags "text near the page edge" calls every well-formed CV
 * broken. What actually identifies a running header is repetition: the same
 * text appearing in the margin band of more than one page. On a single-page
 * document there is nothing to detect, so nothing is claimed.
 */
function runningHeaderFooter(cv: CvProfile): string[] {
  const pages = cv.layout ?? []
  if (pages.length < 2) return []

  const bandsPerPage = pages.map((page) => {
    const inBand = page.items.filter(
      (it) => it.y > page.height * 0.93 || it.y < page.height * 0.07
    )
    return new Set(
      inBand
        .map((it) => it.text.trim().toLowerCase())
        .filter((t) => t.length > 3 && !/^\d+$/.test(t) && !/^page \d+/.test(t))
    )
  })

  // Repeated in the margin band of at least two pages.
  const counts = new Map<string, number>()
  for (const band of bandsPerPage) {
    for (const t of band) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([t]) => t)
}

/**
 * Detects a multi-column layout by looking for a vertical band that no text
 * crosses. A real two-column CV leaves a clear gutter; a single-column one
 * with indented bullets does not.
 */
function looksMultiColumn(cv: CvProfile): boolean {
  const pages = cv.layout ?? []
  if (!pages.length) return false

  let columnPages = 0
  for (const page of pages) {
    const items = page.items.filter((i) => i.text.trim().length > 1)
    if (items.length < 30) continue

    // Sample the page width in vertical strips and count how many text runs
    // cross each strip. A gutter is a strip almost nothing crosses, sitting
    // away from the page edges, with substantial text on both sides.
    const strips = 40
    const crossings = new Array(strips).fill(0)
    for (const it of items) {
      const a = Math.floor((it.x / page.width) * strips)
      const b = Math.floor(((it.x + it.w) / page.width) * strips)
      for (let s = Math.max(0, a); s <= Math.min(strips - 1, b); s++) crossings[s]++
    }

    for (let s = Math.floor(strips * 0.28); s <= Math.floor(strips * 0.72); s++) {
      if (crossings[s] > items.length * 0.02) continue
      const left = crossings.slice(0, s).reduce((a, b) => a + b, 0)
      const right = crossings.slice(s + 1).reduce((a, b) => a + b, 0)
      if (left > items.length * 0.25 && right > items.length * 0.25) {
        columnPages++
        break
      }
    }
  }
  return columnPages > 0
}

export function checkCv(cv: CvProfile, target?: Job | null): AtsReport {
  const checks: AtsCheck[] = []
  const t = cv.text

  /* ---- weighted: these genuinely affect whether a machine can read it ---- */

  const readable = cv.words >= 120
  checks.push({
    id: 'extractable',
    label: 'Text can be extracted',
    verdict: readable ? 'pass' : 'warn',
    weight: 30,
    detail: readable
      ? `${cv.words} words read cleanly from your ${cv.fileKind.toUpperCase()}.`
      : cv.fileKind === 'pdf'
        ? 'Very little text came out, which usually means the CV is a scan or an exported image. Re-export it from the original document so the words are real text.'
        : 'Very little text came out of this file. Check it opens correctly.',
  })

  /**
   * Weighted on the email alone. An email address is the one contact detail a
   * parser must be able to read, and its absence really does break things. A
   * missing phone number does not break parsing at all, so it is raised as a
   * suggestion further down rather than costing marks here.
   */
  const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(t)
  const phone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(t)
  checks.push({
    id: 'contact',
    label: 'Contact details are findable',
    verdict: email ? 'pass' : 'warn',
    weight: 20,
    detail: email
      ? phone
        ? 'Email and phone number both found in readable text.'
        : 'Your email address was found in readable text.'
      : 'No email address was found as readable text. If it only exists inside an image or a logo, a parser cannot pick it up, and neither can a recruiter copying it.',
  })

  const foundSections = SECTION_WORDS.filter(([, re]) => has(t, re)).map(([name]) => name)
  const sectionOk = foundSections.length >= 2
  checks.push({
    id: 'sections',
    label: 'Standard section headings',
    verdict: sectionOk ? 'pass' : 'warn',
    weight: 15,
    detail: sectionOk
      ? `Found ${foundSections.join(', ')}. Parsers look for these exact words.`
      : 'Parsers look for plain headings like Experience, Education and Skills. Creative alternatives such as "My Journey" often get skipped.',
  })

  const dateRange =
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(?:19|20)\d{2}\b/i.test(t) ||
    /\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:19|20)\d{2}|present|current)\b/i.test(t)
  checks.push({
    id: 'dates',
    label: 'Employment dates are machine-readable',
    verdict: dateRange ? 'pass' : 'warn',
    weight: 10,
    detail: dateRange
      ? 'Date ranges are in a format parsers handle.'
      : 'No clear date ranges found. "Mar 2024 – Present" or "2024 – 2026" both parse reliably.',
  })

  const repeated = runningHeaderFooter(cv)
  const headerHasContact = repeated.some((line) => /@|\+?\d[\d\s().-]{7,}/.test(line))
  checks.push({
    id: 'margins',
    label: 'Nothing essential is stuck in a running header',
    verdict: headerHasContact ? 'warn' : 'pass',
    weight: 10,
    detail: headerHasContact
      ? 'Your contact details appear in a header or footer that repeats on every page. Some parsers skip those regions entirely. Keep a copy in the main body of the first page.'
      : (cv.layout?.length ?? 1) < 2
        ? 'Single page, so there is no repeating header to get lost in.'
        : 'No repeating header or footer is holding anything essential.',
  })

  const fileOk = cv.fileKind === 'pdf' || cv.fileKind === 'docx'
  checks.push({
    id: 'format',
    label: 'File format',
    verdict: fileOk ? 'pass' : 'warn',
    weight: 5,
    detail: fileOk
      ? `${cv.fileKind.toUpperCase()} is accepted everywhere. Keep a DOCX copy too, since a few older systems still prefer it.`
      : 'Plain text works for this check, but send employers a PDF or DOCX.',
  })

  /* ---------------- tips: never weighted, never reduce the score --------- */

  if (email && !phone) {
    checks.push({
      id: 'phone',
      label: 'No phone number found',
      verdict: 'tip',
      weight: 0,
      detail:
        'Parsers do not need one, so this costs you no marks. But recruiters who want to move fast reach for the phone, and an email-only CV can sit in an inbox for days. Worth adding next to your email.',
    })
  }

  const multi = looksMultiColumn(cv)
  if (multi) {
    checks.push({
      id: 'columns',
      label: 'Two-column layout detected',
      verdict: 'tip',
      weight: 0,
      detail:
        'Most current parsers handle two columns fine, and yours read cleanly here. Worth knowing that a few older systems read straight across and jumble the order, so a single-column copy is a safe backup for applications that matter most.',
    })
  }

  if (cv.words > 0 && (cv.words < 300 || cv.words > 1200)) {
    checks.push({
      id: 'length',
      label: cv.words < 300 ? 'On the short side' : 'On the long side',
      verdict: 'tip',
      weight: 0,
      detail:
        cv.words < 300
          ? `${cv.words} words. Nothing wrong with brief, but there may be room to say more about what you actually built and what changed as a result.`
          : `${cv.words} words. Long is fine for a detailed technical CV. Just make sure the first half carries your strongest work.`,
    })
  }

  const bullets = (t.match(/^\s*[•▪◦‣·\-–—*]\s+/gm) ?? []).length
  if (bullets < 5) {
    checks.push({
      id: 'bullets',
      label: 'Few bullet points found',
      verdict: 'tip',
      weight: 0,
      detail:
        'Dense paragraphs are harder for both parsers and humans to skim. Short bullets under each role tend to read better.',
    })
  }

  const quantified = (t.match(/\b\d[\d,.]*\s*(?:%|percent|k\b|million|users?|customers?|hours?|days?|x\b)/gi) ?? [])
    .length
  if (quantified < 3) {
    checks.push({
      id: 'numbers',
      label: 'Add a few numbers',
      verdict: 'tip',
      weight: 0,
      detail:
        'Concrete figures make claims land — how many, how much faster, how many users. This has nothing to do with parsing; it just reads stronger.',
    })
  }

  if (target) {
    const missing = target.tags.filter((tag) => !cv.skills.includes(tag))
    missing.sort((a, b) => weightOf(b) - weightOf(a))
    const top = missing.slice(0, 6).map(labelOf)
    if (top.length) {
      checks.push({
        id: 'keywords',
        label: `Terms this role mentions that your CV does not`,
        verdict: 'tip',
        weight: 0,
        detail: `${top.join(', ')}. Only add the ones you have genuinely used — a keyword you cannot talk about in an interview costs more than it gains.`,
      })
    }
  }

  /* --------------------------------- score ------------------------------ */

  const weighted = checks.filter((c) => c.weight > 0)
  const earned = weighted.reduce((sum, c) => sum + (c.verdict === 'pass' ? c.weight : 0), 0)
  const possible = weighted.reduce((sum, c) => sum + c.weight, 0)

  // Floored at 40 for anything readable. A CV that a parser can read is never
  // a disaster, and a number in the teens tells the person nothing useful.
  const raw = possible ? (earned / possible) * 100 : 0
  const score = readable ? Math.round(40 + raw * 0.6) : Math.round(raw * 0.6)

  const band: AtsReport['band'] =
    score >= 88 ? 'clean' : score >= 74 ? 'good' : score >= 58 ? 'fixable' : 'rough'

  return { score, band, checks }
}

export const BAND_COPY: Record<AtsReport['band'], { title: string; note: string }> = {
  clean: {
    title: 'Reads cleanly',
    note: 'A parser gets everything it needs from this. Anything below is optional polish.',
  },
  good: {
    title: 'In good shape',
    note: 'This will parse fine almost everywhere. One or two small fixes would tighten it.',
  },
  fixable: {
    title: 'A few things worth fixing',
    note: 'Nothing here is serious, but the flagged items are the ones that occasionally cost people an application.',
  },
  rough: {
    title: 'Worth a rework',
    note: 'Some details a parser needs are hard to reach. The fixes below are quick and make a real difference.',
  },
}
