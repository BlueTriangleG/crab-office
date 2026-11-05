import { clip, isGoneOf, whoOf } from "./office.ts"
import type { Snapshot } from "./office.ts"
import { w } from "./words.ts"

// What a session needs the chairman to decide, on the chairman's list until it
// is settled: by the session that asked once the chairman has answered, by the
// CEO, or by the chairman's ✓ in the pane. Kept until then in the asker's
// context alone, a compaction lost the detail and no other session saw what
// was stuck on the chairman. One writer a file: `decisions/<id>.json` the
// asker's, `settled/<id>.<writer>.json` whoever settled it.
// `line`: put there from the CEO's tracker, a line waiting on the chairman.
// `theme`: the CEO asking, for that theme, how the chairman is to be addressed.
export type Decision = { id: string; by: string; at: number; text: string; line?: string; theme?: string }
export type Settled = { id: string; by: string; at: number; text: string }

export function pendingOf(asked: Decision[], settled: Settled[]): Decision[] {
  const done = new Set(settled.map((s) => s.id))
  return asked.filter((d) => !done.has(d.id)).sort((a, b) => a.at - b.at)
}

export function settleRefusal(d: Decision | undefined, me: string, isCeo: boolean): string | undefined {
  if (d === undefined) return w().tool.noDecision
  return d.by === me || isCeo ? undefined : w().tool.notYourDecision
}

// Who is waiting, by its job title, else its place; one that has left still
// shows by its id, since what it asked may still need deciding.
export function rowsOf(pending: Decision[], snaps: Snapshot[], titles: Record<string, string>): { id: string; who: string; text: string }[] {
  return pending.map((d) => {
    const s = snaps.find((x) => x.sessionId === d.by)
    return { id: d.id, who: titles[d.by] ?? (s === undefined ? d.by : whoOf(s)), text: d.text }
  })
}

// The chairman's answer, typed under an item on the list: it goes to the session
// that asked as an instruction from a card does, the chairman's own words in its
// prompt, and not as one session's message to another, which a session rightly
// does not take as the chairman's approval.
export function answerOf(d: Decision, answer: string): string {
  return w().chairmanAnswer(d.id, clip(d.text, 120), answer)
}

// Whether the session that asked is at work to take the answer now, or the
// answer waits in its instructions until it comes back, as any instruction does
// for a day. A receipt that said "sent" either way read as delivered.
export function isAway(asker: Snapshot | undefined, now: number): boolean {
  return asker === undefined || isGoneOf(asker, now)
}
