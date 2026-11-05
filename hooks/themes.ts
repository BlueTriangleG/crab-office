import { w } from "./words.ts"
import type { ThemeWords } from "./words.ts"

// A theme: how the office names the chairman and its ranks, and the voice the
// crabs talk in, to each other and to the chairman. Names and tone alone: what a
// report says, and everything a session makes (code, commits, PRs, docs,
// product copy), is never themed. A theme is a folder (`themes/<id>/`) holding
// its `theme.json`, so one day it can bring the crabs' looks and moves beside it:
// the plugin's own folders are its built-in themes, the person's own are in
// `~/.claude/crab-office/themes/`.
export type Theme = {
  // The theme's folder: themes/<id>/theme.json, beside whatever else it brings.
  id: string
  name: string
  // How everyone addresses the chairman; the choice can name another. With
  // `{name}` in it (X总), the CEO asks the chairman what the name is, and
  // `chairmanUnnamed` stands until the chairman answers.
  chairman?: string
  chairmanUnnamed?: string
  nameQuestion?: string
  // Ranks' and roles' names, by the keys the office's own titles use.
  titles?: Record<string, string>
  // Terms renamed through the office's own words (开会 → 组会); the longest wins.
  terms?: Record<string, string>
  // The office's language while the theme is on, where its terms are in one.
  language?: "zh" | "en"
  voice?: string
  // A few lines in that voice; `{chairman}` stands for how the chairman is addressed.
  examples?: string[]
}

// The office as it is, the theme with nothing to change.
export const DEFAULT_THEME = "default"

// The chosen theme, office-wide (`theme.json`): whichever session the chairman
// chose it in, every session takes it on its next tick.
export type ThemeChoice = { name: string; chairman?: string; at: number }

// "/office theme 字节 高总": the theme, then how to address the chairman.
export function parseThemeArgs(args: string): { name: string; chairman?: string } | undefined {
  const [name, ...rest] = args.trim().split(/\s+/)
  if (name === undefined || name === "") return undefined
  const chairman = rest.join(" ").trim()
  return chairman === "" ? { name } : { name, chairman }
}

// By its folder or its name; the person's own are listed first, so one of theirs
// wins over a built-in one of the same name.
export function themeNamed(name: string, themes: Theme[]): Theme | undefined {
  const key = name.trim().toLowerCase()
  return themes.find((t) => t.id.toLowerCase() === key || t.name.toLowerCase() === key)
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined)
const strings = (v: unknown): Record<string, string> | undefined => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return undefined
  const kept = Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string")
  return kept.length === 0 ? undefined : Object.fromEntries(kept)
}

// A folder's theme.json, kept to what a theme may hold: a field of the wrong
// shape is left out, not the theme; unreadable JSON is no theme. Fields a later
// version reads (the crabs' looks) are left for it.
export function parseTheme(text: string, id: string): Theme | undefined {
  let raw: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return undefined
    raw = parsed as Record<string, unknown>
  } catch {
    return undefined
  }
  const language = raw.language === "zh" || raw.language === "en" ? raw.language : undefined
  const examples = Array.isArray(raw.examples) ? raw.examples.filter((e): e is string => typeof e === "string") : []
  const fields = {
    language,
    chairman: str(raw.chairman),
    chairmanUnnamed: str(raw.chairmanUnnamed),
    nameQuestion: str(raw.nameQuestion),
    titles: strings(raw.titles),
    terms: strings(raw.terms),
    voice: str(raw.voice),
    examples: examples.length === 0 ? undefined : examples,
  }
  return { id, name: str(raw.name) ?? id, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) }
}

// What a session is told when a theme comes in: once at start, again after a
// compaction, and when the theme changes. The system prompt never reaches the
// sessions (another plugin ahead of this one leaves the section out), so it goes
// into the conversation itself.
export function themeNote(theme: Theme, chairman: string): string {
  const examples = (theme.examples ?? []).map((e) => e.replaceAll("{chairman}", chairman))
  return w().themeNote(theme.name, chairman, theme.voice ?? "", examples)
}

export function themeOff(): string {
  return w().themeOff
}

// Whether the chairman has yet to say how to be addressed: the theme's name has
// a blank in it, and the choice fills none.
export function needsName(theme: Theme, choice: ThemeChoice): boolean {
  return choice.chairman === undefined && (theme.chairman ?? "").includes("{name}")
}

export function chairmanFor(theme: Theme, choice: ThemeChoice): string {
  if (choice.chairman !== undefined) return choice.chairman
  if (needsName(theme, choice)) return theme.chairmanUnnamed ?? ""
  return theme.chairman ?? ""
}

// The name in the chairman's answer, as it was put: "高", "高总", "叫我高总".
export function nameFrom(answer: string): string {
  return answer
    .trim()
    .replace(/[。.!！]+$/, "")
    .replace(/^(叫我|我是|就叫|称呼我)/, "")
    .replace(/总$/, "")
    .trim()
}

// The words a theme puts over the office's: its titles and terms, and the
// chairman's name wherever the office names the chairman, 董事长, or waits on
// the chairman, 等你. Two 等你 speak to a session, whose 你 is itself, and keep it.
export function namesFor(theme: Theme, chairman: string): ThemeWords {
  const named: Record<string, string> = chairman === "" ? {} : { 董事长: chairman, 等你: `等${chairman}`, 等你验收: "等你验收", 不等你: "不等你" }
  return {
    ...(chairman === "" ? {} : { chairman }),
    ...(theme.titles ? { titles: theme.titles } : {}),
    terms: { ...theme.terms, ...named },
  }
}
