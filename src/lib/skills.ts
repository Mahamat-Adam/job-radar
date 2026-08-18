import raw from '@/data/skills.json'

/**
 * Skill vocabulary.
 *
 * The list itself lives in src/data/skills.json because the daily collector
 * runs in plain Node and has to tag jobs with exactly the same vocabulary the
 * browser matches against. One file, two readers.
 *
 * `weight` is how much a match tells you. Everyone lists JavaScript, so it
 * proves almost nothing; React Three Fiber narrows the field to a handful of
 * roles. Weights are hand-set rather than derived, because a corpus of a few
 * thousand jobs is far too small to learn stable values from.
 */
export type SkillGroup =
  | 'language'
  | 'frontend'
  | 'backend'
  | 'data'
  | 'cloud'
  | 'practice'
  | 'solutions'
  | 'tooling'
  | 'mobile'

export type Skill = {
  id: string
  label: string
  group: SkillGroup
  weight: number
  aliases?: string[]
}

export const SKILLS = raw as Skill[]

export const BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]))

/** Longest surface form first, so "react three fiber" wins over "react". */
const MATCHERS: { skill: Skill; form: string }[] = SKILLS.flatMap((skill) => {
  const forms = [skill.label.toLowerCase(), ...(skill.aliases ?? [])]
  return forms.map((form) => ({ skill, form }))
}).sort((a, b) => b.form.length - a.form.length)

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Word-boundary match against a lowercased haystack. `C#` and `.NET` cannot
 * use \b on their outer character, so the boundary is applied only where that
 * character is alphanumeric.
 */
function present(haystack: string, form: string): boolean {
  const left = /[a-z0-9]/.test(form[0]) ? '(?<![a-z0-9])' : ''
  const right = /[a-z0-9]/.test(form[form.length - 1]) ? '(?![a-z0-9])' : ''
  return new RegExp(`${left}${escape(form)}${right}`).test(haystack)
}

export function extractSkills(text: string): string[] {
  const hay = text.toLowerCase()
  const found = new Set<string>()
  for (const { skill, form } of MATCHERS) {
    if (found.has(skill.id)) continue
    if (present(hay, form)) found.add(skill.id)
  }
  return [...found]
}

export function weightOf(id: string): number {
  return BY_ID[id]?.weight ?? 0.6
}

export function labelOf(id: string): string {
  return BY_ID[id]?.label ?? id
}
