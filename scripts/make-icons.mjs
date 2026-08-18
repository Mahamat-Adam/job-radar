/**
 * Renders the app mark to PNG at the sizes iOS and Android need for a
 * home-screen install. Uses the Chrome already on the machine rather than an
 * image library, so there is no native dependency to build.
 *
 *   node scripts/make-icons.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public/icons')
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

/**
 * A globe reduced to what still reads at 40px: a filled disc, two meridians,
 * one equator, and a single bright marker. Detail beyond that turns to mush at
 * home-screen size.
 *
 * `pad` insets the artwork for the maskable/iOS variants, where the platform
 * crops to a rounded square and can clip anything near the edge.
 */
const mark = ({ size = 512, pad = 0, bg = true } = {}) => {
  const c = size / 2
  const r = (size / 2 - size * pad) * 0.86
  const sw = Math.max(1.5, size * 0.022)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#60A5FA"/>
      <stop offset="0.55" stop-color="#3B82F6"/>
      <stop offset="1" stop-color="#1D4ED8"/>
    </linearGradient>
    <radialGradient id="shine" cx="0.34" cy="0.28" r="0.75">
      <stop offset="0" stop-color="#BFDBFE" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#1D4ED8" stop-opacity="0"/>
    </radialGradient>
  </defs>

  ${bg ? `<rect width="${size}" height="${size}" rx="${size * 0.21}" fill="#04091A"/>` : ''}

  <circle cx="${c}" cy="${c}" r="${r}" fill="url(#sky)"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="url(#shine)"/>

  <g fill="none" stroke="#04091A" stroke-opacity="0.42" stroke-width="${sw}">
    <ellipse cx="${c}" cy="${c}" rx="${r * 0.42}" ry="${r}"/>
    <line x1="${c}" y1="${c - r}" x2="${c}" y2="${c + r}"/>
    <line x1="${c - r}" y1="${c}" x2="${c + r}" y2="${c}"/>
  </g>

  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#93C5FD" stroke-opacity="0.55" stroke-width="${sw * 0.9}"/>

  <circle cx="${c + r * 0.42}" cy="${c - r * 0.44}" r="${r * 0.2}" fill="#38D9E8" fill-opacity="0.28"/>
  <circle cx="${c + r * 0.42}" cy="${c - r * 0.44}" r="${r * 0.1}" fill="#EAF2FF"/>
</svg>`
}

const TARGETS = [
  { file: 'icon-180.png', size: 180, pad: 0.06 },
  { file: 'icon-192.png', size: 192, pad: 0.06 },
  { file: 'icon-512.png', size: 512, pad: 0.06 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.14 },
]

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'mark.svg'), mark({ size: 512, pad: 0.06 }))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars'],
})

try {
  const page = await browser.newPage()
  for (const t of TARGETS) {
    await page.setViewport({ width: t.size, height: t.size, deviceScaleFactor: 1 })
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>${mark({ size: t.size, pad: t.pad })}`,
      { waitUntil: 'domcontentloaded' }
    )
    await page.screenshot({ path: path.join(outDir, t.file), omitBackground: false })
    console.log(`  ${t.file}  ${t.size}x${t.size}`)
  }
} finally {
  await browser.close()
}

console.log('icons written to public/icons')
