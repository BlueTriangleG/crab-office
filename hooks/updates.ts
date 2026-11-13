import { clip, clockOf, whoOf } from "./office.ts"
import type { Snapshot } from "./office.ts"

// A word to the chairman (`updates/<id>.json`, office_board post with no `to`),
// kept under the office: in the session that said it, the reply scrolled away
// under every nudge and message after it.
export type Update = { id: string; at: number; by: string; text: string }
export type UpdateRow = { who?: string; when: string; text: string }

export const UPDATES_SHOWN = 5
// The newest as it was written, lines and all; the ones before it a line each.
const NEWEST_MAX = 1500
const EARLIER_MAX = 80

export function updateRowsOf(updates: Update[], snaps: Snapshot[], titles: Record<string, string>): UpdateRow[] {
  return [...updates]
    .sort((a, b) => b.at - a.at)
    .slice(0, UPDATES_SHOWN)
    .map((u, i) => {
      const s = snaps.find((x) => x.sessionId === u.by)
      const who = titles[u.by] ?? (s === undefined ? undefined : whoOf(s))
      const whole = u.text.trim()
      const text = i > 0 ? clip(whole, EARLIER_MAX) : whole.length > NEWEST_MAX ? `${whole.slice(0, NEWEST_MAX - 1)}…` : whole
      return { when: clockOf(u.at), text, ...(who === undefined ? {} : { who }) }
    })
}
