import { clockOf, whoOf } from "./office.ts"
import type { Snapshot } from "./office.ts"

// The CEO's report to the chairman (`update.json`, office_board post with no
// `to`), kept under the CEO's tracker: in the CEO's own session the reply
// scrolled away under every nudge and message after it. Each report is the
// whole picture, so it replaces the one before and stays until the next.
export type Update = { id: string; at: number; by: string; text: string }
export type UpdateRow = { who?: string; when: string; text: string }

const TEXT_MAX = 1500

export function updateRowOf(u: Update | undefined, snaps: Snapshot[], titles: Record<string, string>, now: number): UpdateRow | undefined {
  if (u === undefined) return undefined
  const s = snaps.find((x) => x.sessionId === u.by)
  const who = titles[u.by] ?? (s === undefined ? undefined : whoOf(s))
  const whole = u.text.trim()
  const text = whole.length > TEXT_MAX ? `${whole.slice(0, TEXT_MAX - 1)}…` : whole
  // It stays until the next report, so one from another day says which.
  const day = new Date(u.at)
  const when = day.toDateString() === new Date(now).toDateString() ? clockOf(u.at) : `${day.getMonth() + 1}-${day.getDate()} ${clockOf(u.at)}`
  return { when, text, ...(who === undefined ? {} : { who }) }
}
