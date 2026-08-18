import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Tagging, sharing its vocabulary with the browser via src/data/skills.json.
 * The matching rule has to stay identical to the one in src/lib/skills.ts, or
 * a job would be tagged with terms the CV matcher never looks for.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const SKILLS = JSON.parse(fs.readFileSync(path.join(here, '../data/skills.json'), 'utf8'))

const MATCHERS = SKILLS.flatMap((skill) =>
  [skill.label.toLowerCase(), ...(skill.aliases ?? [])].map((form) => ({ skill, form }))
).sort((a, b) => b.form.length - a.form.length)

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function present(hay, form) {
  const left = /[a-z0-9]/.test(form[0]) ? '(?<![a-z0-9])' : ''
  const right = /[a-z0-9]/.test(form[form.length - 1]) ? '(?![a-z0-9])' : ''
  return new RegExp(`${left}${escape(form)}${right}`).test(hay)
}

export function extractSkills(text) {
  const hay = String(text ?? '').toLowerCase()
  const found = new Set()
  for (const { skill, form } of MATCHERS) {
    if (found.has(skill.id)) continue
    if (present(hay, form)) found.add(skill.id)
  }
  return [...found]
}
