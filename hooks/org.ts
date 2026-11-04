import { LEAVE_MS, isGoneOf, peerOf, teamNameOf, whoOf } from "./office.ts"
import type { Note, Snapshot } from "./office.ts"
import { LEADER_COLOR, titleOf } from "./pixels.ts"
import type { Speaker } from "./pixels.ts"
import { HQ_NAMES, w } from "./words.ts"

// Who runs the office: the CEO the chairman appointed, and each repository's
// 部长 by appointment. Each session writes only its own records, so two
// sessions where the chairman clicked never write one file; every session works
// the same answer out of all of them, the latest record standing.
export type Appointment = {
  kind: "ceo" | "head"
  // A head's repository, as the board names it (the department).
  project?: string
  // null revokes.
  sessionId: string | null
  at: number
  by: "chairman" | "ceo"
}

// `heads` holds appointed heads alone; a repository without one is headed by
// its longest-serving session (chiefsOf).
export type Org = { ceo?: string; heads: Record<string, string> }

export const NO_ORG: Org = { heads: {} }

export type Rank = "ceo" | "head" | "staff"

function latest(records: Appointment[]): Appointment | undefined {
  return records.reduce<Appointment | undefined>((a, r) => (a === undefined || r.at > a.at ? r : a), undefined)
}

// An appointment lapses once its session has left the company, as the drawing
// lets it go; a head never is the CEO, and the chairman's pick of one stands
// over the CEO's until the chairman revokes it.
export function orgOf(records: Appointment[], snaps: Snapshot[], now: number): Org {
  const present = new Set(snaps.filter((s) => now - s.updatedAt < LEAVE_MS).map((s) => s.sessionId))
  const named = (r: Appointment | undefined) =>
    r?.sessionId !== null && r?.sessionId !== undefined && present.has(r.sessionId) ? r.sessionId : undefined
  const ceo = named(latest(records.filter((r) => r.kind === "ceo")))
  const heads: Record<string, string> = {}
  const projects = new Set(records.flatMap((r) => (r.kind === "head" && r.project !== undefined ? [r.project] : [])))
  for (const project of projects) {
    const own = records.filter((r) => r.kind === "head" && r.project === project)
    const chairman = latest(own.filter((r) => r.by === "chairman"))
    const picks = [chairman?.sessionId === null ? undefined : chairman, latest(own.filter((r) => r.by === "ceo"))]
    const id = picks.map(named).find((x) => x !== undefined && x !== ceo)
    if (id !== undefined) heads[project] = id
  }
  return { ...(ceo === undefined ? {} : { ceo }), heads }
}

export function rankOf(sessionId: string, org: Org, chiefs: Set<string>): Rank {
  if (org.ceo === sessionId) return "ceo"
  return chiefs.has(sessionId) ? "head" : "staff"
}

// "/office ceo @<who>", "/office ceo off", "/office head @<who>", or
// "/office head off [@<who or repository>]" (no name: this session's repository).
export function parseAppoint(args: string): { kind: "ceo" | "head"; name: string | null; isOff: boolean } | undefined {
  const m = /^(ceo|head)(?:\s+(off))?(?:\s+(.+))?$/i.exec(args.trim())
  const kind = m?.[1]?.toLowerCase()
  if (kind !== "ceo" && kind !== "head") return undefined
  const isOff = m?.[2] !== undefined
  const name = m?.[3]?.trim().replace(/^@/, "") || null
  if (!isOff && name === null) return undefined
  return { kind, name, isOff }
}

// The one session a name means: a SendMessage name or socket, a session as the
// board names it (web-app 部 · docs), or a team. A name that fits two means
// neither, and `many` says which it fitted.
export function sessionNamed(
  to: string,
  snaps: Snapshot[],
  peers: unknown[],
  now: number,
): { one?: Snapshot; many: Snapshot[] } {
  const name = to.trim().replace(/^@/, "").replace(/\s*(组|team)$/i, "")
  const here = snaps.filter((s) => !isGoneOf(s, now))
  const peer = peerOf(peers, name)
  const isHq = HQ_NAMES.has(name.toLowerCase())
  const levels = [
    here.filter((s) => s.sessionId === peer?.sessionId),
    here.filter((s) => whoOf(s) === name),
    here.filter((s) => teamNameOf(s) === name || (isHq && s.team === undefined)),
  ]
  const many = levels.find((level) => level.length > 0) ?? []
  const [only] = many
  return many.length === 1 && only !== undefined ? { one: only, many } : { many }
}

// An appointment or its revocation as a line on the writer's own board: the
// session it is about is its other end, so the line names it and its crab has
// the ✉, wherever the chairman clicked.
export function appointedNote(by: Speaker, target: Snapshot, kind: "ceo" | "head", isRevoked: boolean, now: number): Note {
  return {
    at: now,
    kind: "message",
    from: by,
    to: { name: whoOf(target), color: LEADER_COLOR, id: target.sessionId },
    text: w().appointedLine(titleOf(kind === "ceo" ? "ceo" : "chief"), isRevoked),
  }
}
