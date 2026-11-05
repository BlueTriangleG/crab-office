import { w } from "./words.ts"

// A theme: how the office names the chairman and its ranks, and the voice the
// crabs talk in, to each other and to the chairman. Names and tone alone: what a
// report says, and everything a session makes (code, commits, PRs, docs,
// product copy), is never themed. One day a theme may draw the crabs too.
export type Theme = {
  name: string
  // How everyone addresses the chairman; the choice can name another.
  chairman?: string
  // Ranks' and roles' names, by the keys the office's own titles use.
  titles?: Record<string, string>
  voice?: string
  // A few lines in that voice; `{chairman}` stands for how the chairman is addressed.
  examples?: string[]
}

// The office as it is, the theme with nothing to change.
export const DEFAULT_THEME = "default"

export const BUILT_IN: Theme[] = [
  {
    name: "字节",
    chairman: "老板",
    titles: { leader: "同学", lead: "同学" },
    voice:
      "像字节跳动的同学一样说话：互相称呼“同学”，直接、节奏快，常用“对齐”“拉通”“同步一下”“闭环”“抓手”“颗粒度”“对一下口径”“辛苦”“收到”这类说法；跟董事长说话先叫一声称呼，再说正事。",
    examples: [
      "同学你好，这边想跟你对齐一下结账 API 的字段，方便的话拉个会？",
      "收到，这块我来闭环，今天下班前同步结论。",
      "{chairman}，同步一下进展：",
    ],
  },
]

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

// The person's own file of a name wins over a built-in one.
export function themeNamed(name: string, files: Theme[]): Theme | undefined {
  const key = name.trim().toLowerCase()
  return [...files, ...BUILT_IN].find((t) => t.name.toLowerCase() === key)
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
