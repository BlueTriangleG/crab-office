import { LEAVE_MS } from "./office.ts"
import type { Snapshot } from "./office.ts"

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
