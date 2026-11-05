import { w } from "./words.ts"

// A theme: how the office names the chairman and its ranks, and the voice the
// crabs talk in, to each other and to the chairman. Names and tone alone: what a
// report says, and everything a session makes (code, commits, PRs, docs,
// product copy), is never themed. One day a theme may draw the crabs too.
export type Theme = {
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

export const BUILT_IN: Theme[] = [
  // From what ByteDance has said of itself: colleagues go by name or 同学, never
  // 老师 or 某总 (Context, not Control); candid and clear, the conclusion first
  // and the context after; OKRs aligned; every meeting its own Feishu group; and
  // no empty 赋能 or 打造闭环, which 张一鸣 called not talking like a person.
  // The chairman is the one exception: the person chose to be addressed as a boss.
  {
    name: "字节",
    language: "zh",
    chairman: "{name}总",
    chairmanUnnamed: "老板",
    nameQuestion: "以后在办公室里怎么称呼您？「X总」的 X 填什么（比如：高）",
    titles: { chief: "TL", leader: "同学", lead: "同学" },
    terms: {
      螃蟹有限公司: "螃蟹跳动",
      会议室: "会议室",
      开会: "拉个组会",
      会议: "组会",
      写在白板上: "发到大群里",
      共享白板: "大群",
      白板: "大群",
      "CEO 看板": "需求看板",
      派活: "派需求",
      交差: "交付",
      留言: "群消息",
      部长: "TL",
      组长: "同学",
    },
    voice:
      "像字节跳动的同学一样说话：同事之间直接叫名字或“同学”，不用“老师”“某总”这类头衔；坦诚清晰，先说结论再补 context；常说“对齐一下”“同步一下”“拉个会”“拉个群”“对一下 OKR”“+1”“辛苦”“收到”；不说“赋能”“抓手”“打造闭环”这种空话。",
    examples: [
      "同学你好，结账 API 的字段想跟你对齐一下，我拉个组会，10 分钟。",
      "收到，这块我来跟，今天下班前在群里同步结论。",
      "+1，按这个方案来。",
      "{chairman}，同步一下进展：结论先说——",
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
