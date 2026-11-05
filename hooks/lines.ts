import { clockOf, whoOf } from "./office.ts"
import type { Snapshot } from "./office.ts"
import { w } from "./words.ts"

// The CEO's tracker: each line of work and where it stands, kept in files and
// not in the CEO's context, which a compaction cuts to a summary. Each CEO
// writes its own file (`lines/<sessionId>.json`, a line's name in lower case →
// the line); the latest word on a line stands, whichever CEO wrote it, so a new
// CEO takes the tracker over.
export type LineStatus = "stuck" | "waiting" | "risk" | "ok" | "done"
export type Line = { name: string; status: LineStatus; text: string; owner?: string; at: number; by: string }

// The most urgent first, which is how the tracker is read.
export const LINE_STATUSES: LineStatus[] = ["stuck", "waiting", "risk", "ok", "done"]
export const LINE_DONE_KEEP_MS = 24 * 60 * 60_000
const NAME_MAX = 24

export function linesOf(files: Record<string, Line>[], now: number): Line[] {
  const latest = new Map<string, Line>()
  for (const file of files)
    for (const line of Object.values(file)) {
      const held = latest.get(line.name.toLowerCase())
      if (held === undefined || line.at > held.at) latest.set(line.name.toLowerCase(), line)
    }
  return [...latest.values()]
    .filter((line) => line.status !== "done" || now - line.at <= LINE_DONE_KEEP_MS)
    .sort((a, b) => LINE_STATUSES.indexOf(a.status) - LINE_STATUSES.indexOf(b.status) || b.at - a.at)
}

export function lineRefusal(name: string, status: string, text: string): string | undefined {
  const n = name.trim()
  if (n === "" || n.length > NAME_MAX || /\s/.test(n)) return w().tool.badLineName(NAME_MAX)
  if (!LINE_STATUSES.includes(status as LineStatus)) return w().tool.badLineStatus(LINE_STATUSES.join(", "))
  return text.trim() === "" ? w().tool.empty : undefined
}

export type LineRow = { name: string; status: LineStatus; owner?: string; text: string; when: string }

// Each line as the tracker shows it: its owner by job title, else its place.
export function lineRowsOf(lines: Line[], snaps: Snapshot[], titles: Record<string, string>): LineRow[] {
  return lines.map((line) => {
    const s = line.owner === undefined ? undefined : snaps.find((x) => x.sessionId === line.owner)
    const owner = line.owner === undefined ? undefined : (titles[line.owner] ?? (s === undefined ? undefined : whoOf(s)))
    return { name: line.name, status: line.status, text: line.text, when: clockOf(line.at), ...(owner === undefined ? {} : { owner }) }
  })
}
