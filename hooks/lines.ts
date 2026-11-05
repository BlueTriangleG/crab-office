import type { Decision } from "./decisions.ts"
import { clip, clockOf, whoOf } from "./office.ts"
import type { Snapshot } from "./office.ts"
import { w } from "./words.ts"

// The CEO's tracker: each line of work and where it stands, kept in files and
// not in the CEO's context, which a compaction cuts to a summary. Each CEO
// writes its own file (`lines/<sessionId>.json`, a line's name in lower case →
// the line); the latest word on a line stands, whichever CEO wrote it, so a new
// CEO takes the tracker over.
export type LineStatus = "stuck" | "waiting" | "risk" | "ok" | "done"
export type Line = { name: string; status: LineStatus; text: string; owner?: string; at: number; by: string }

export const LINE_STATUSES: LineStatus[] = ["stuck", "risk", "ok", "waiting", "done"]
// What the tracker shows, the most urgent first: lines still being worked. One
// waiting on the chairman is on the chairman's board instead, and one done is
// off it; the chairman wanted the tracker to hold what is on track, and no more.
const SHOWN: LineStatus[] = ["stuck", "risk", "ok"]
// A line's name is its title as the chairman reads it, spaces and all: a
// one-word rule, borrowed from meeting names (which SendMessage is addressed
// to), had the CEO write titles as hyphenated slugs.
const NAME_MAX = 24
// One short line, where it stands: lines of a hundred characters read as reports.
const TEXT_MAX = 40

export function linesOf(files: Record<string, Line>[]): Line[] {
  const latest = new Map<string, Line>()
  for (const file of files)
    for (const line of Object.values(file)) {
      const held = latest.get(line.name.toLowerCase())
      if (held === undefined || line.at > held.at) latest.set(line.name.toLowerCase(), line)
    }
  return [...latest.values()]
    .filter((line) => SHOWN.includes(line.status))
    .sort((a, b) => SHOWN.indexOf(a.status) - SHOWN.indexOf(b.status) || b.at - a.at)
}

// A line waiting on the chairman, as the CEO's question on the chairman's board:
// the chairman answers it there, and the answer goes to the CEO.
export function askOfLine(line: Line, id: string): Decision {
  return { id, by: line.by, at: line.at, text: `${line.name}：${line.text}`, line: line.name }
}

export function lineRefusal(name: string, status: string, text: string): string | undefined {
  const n = name.trim()
  if (n === "" || [...n].length > NAME_MAX || /[\r\n]/.test(n)) return w().tool.badLineName(NAME_MAX)
  if (!LINE_STATUSES.includes(status as LineStatus)) return w().tool.badLineStatus(LINE_STATUSES.join(", "))
  if (text.trim() === "") return w().tool.empty
  return [...text.trim()].length > TEXT_MAX ? w().tool.lineTooLong(TEXT_MAX) : undefined
}

export type LineRow = { name: string; status: LineStatus; owner?: string; text: string; when: string }

// Each line as the tracker shows it: its owner by job title, else its place.
export function lineRowsOf(lines: Line[], snaps: Snapshot[], titles: Record<string, string>): LineRow[] {
  return lines.map((line) => {
    const s = line.owner === undefined ? undefined : snaps.find((x) => x.sessionId === line.owner)
    const owner = line.owner === undefined ? undefined : (titles[line.owner] ?? (s === undefined ? undefined : whoOf(s)))
    return { name: line.name, status: line.status, text: clip(line.text, TEXT_MAX), when: clockOf(line.at), ...(owner === undefined ? {} : { owner }) }
  })
}
