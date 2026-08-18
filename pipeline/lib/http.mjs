/**
 * Polite HTTP.
 *
 * Every source is fetched one at a time with a gap between calls. Firing them
 * in parallel is faster but looks like scraping to both the source and to any
 * security software sitting in front of the machine running this, and a few of
 * these APIs rate-limit on burst rather than on volume.
 */

const UA =
  'JobRadar/1.0 (personal job search tool; +https://github.com/Mahamat-Adam/job-radar)'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Gap between every outbound request, regardless of source. */
export const POLITE_DELAY = 1200

let lastCall = 0

export async function getJson(url, { timeout = 25000, retries = 2, headers = {} } = {}) {
  const since = Date.now() - lastCall
  if (since < POLITE_DELAY) await sleep(POLITE_DELAY - since)

  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(2500 * attempt)
    lastCall = Date.now()

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
      })
      if (res.status === 429) {
        lastErr = new Error('rate limited')
        await sleep(8000)
        continue
      }
      if (!res.ok) {
        // A 4xx is an answer, not a hiccup. Retrying a board that has been
        // renamed or closed just adds backoff delay for a result that will not
        // change, which matters when the run walks a long list of companies.
        if (res.status >= 400 && res.status < 500) {
          const err = new Error(`HTTP ${res.status}`)
          err.permanent = true
          throw err
        }
        throw new Error(`HTTP ${res.status}`)
      }

      const text = await res.text()
      // A few of these serve an HTML error page with a 200 status.
      if (/^\s*</.test(text)) throw new Error('expected JSON, got HTML')
      return JSON.parse(text)
    } catch (e) {
      lastErr = e
      if (e?.permanent) break
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr ?? new Error('request failed')
}

/** Strips HTML to readable text without pulling in a parser dependency. */
export function stripHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
