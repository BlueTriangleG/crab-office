import { LEAVE_MS } from "./office.ts"
import type { Snapshot } from "./office.ts"
import type { Org, Rank } from "./org.ts"
import { w } from "./words.ts"

// Work the CEO hands a session, as four kinds of file so each has one writer:
// the assignment (`jobs/<id>.json`, the CEO that gave it), each addition to it
// (`amends/<id>.<n>.json`, the CEO), each report (`reports/<id>.<n>.json`, the
// session doing it) and each verdict (`verdicts/<id>.<n>.json`, the CEO that
// judged it). An addition sent only as a message was not kept with the job, so
// the report and the verdict went by two different standards.
export type Assignment = { id: string; at: number; by: string; to: string; task: string; standard?: string }
export type Report = { id: string; n: number; at: number; from: string; text: string }
export type Amend = { id: string; n: number; at: number; by: string; text: string }
// `isWithdrawn`: the CEO took the job back; it closes, judged neither way.
export type Verdict = { id: string; n: number; at: number; by: string; ok: boolean; note: string; isWithdrawn?: boolean }

// assigned and rejected are the session's to move, reported the CEO's; accepted,
// withdrawn and chairman are closed, the last left for the chairman to decide.
export type JobStatus = "assigned" | "reported" | "accepted" | "rejected" | "chairman" | "withdrawn"
export type Job = Assignment & { status: JobStatus; since: number; reports: Report[]; verdicts: Verdict[]; amends: Amend[] }

// Rejected this many times, a job goes no further round: it is the chairman's.
export const REJECTS_MAX = 3

const byAt = (a: { at: number }, b: { at: number }) => a.at - b.at

export function jobsOf(assignments: Assignment[], reports: Report[], verdicts: Verdict[], amends: Amend[] = []): Job[] {
  return assignments.map((a) => {
    const said = reports.filter((r) => r.id === a.id).sort(byAt)
    const judged = verdicts.filter((v) => v.id === a.id).sort(byAt)
    const last = said.at(-1)
    const verdict = judged.at(-1)
    const base = { ...a, reports: said, verdicts: judged, amends: amends.filter((x) => x.id === a.id).sort(byAt) }
    if (verdict !== undefined && (last === undefined || verdict.at >= last.at)) {
      const rejects = judged.filter((v) => !v.ok && !v.isWithdrawn).length
      const status = verdict.isWithdrawn ? "withdrawn" : verdict.ok ? "accepted" : rejects > REJECTS_MAX ? "chairman" : "rejected"
      return { ...base, status, since: verdict.at }
    }
    if (last !== undefined) return { ...base, status: "reported", since: last.at }
    return { ...base, status: "assigned", since: a.at }
  })
}

export type BoardAction =
  | "read"
  | "post"
  | "claim"
  | "staff"
  | "duty"
  | "assign"
  | "report"
  | "accept"
  | "reject"
  | "withdraw"
  | "appoint"
  | "title"
  | "amend"
  | "track"

const OPEN = new Set<JobStatus>(["assigned", "rejected", "reported"])
// What only the CEO's own loop may do: a subagent of the CEO session shares its
// session id, and may have been told it is the CEO.
const CEO_ONLY = new Set<BoardAction>(["assign", "appoint", "duty", "accept", "reject", "withdraw", "amend", "track"])

// Who may do what, decided here and nowhere else: the CEO assigns, judges and
// appoints heads; a head or the CEO writes duties, a head for its own repository
// only; only the session a job was given to reports on it, while it is open.
export function refusalOf(
  action: BoardAction,
  me: string,
  rank: Rank,
  ctx: { job?: Job; target?: Snapshot; myProject: string; org: Org; isSubagent?: boolean },
): string | undefined {
  const { job, target } = ctx
  if (ctx.isSubagent === true && CEO_ONLY.has(action)) return w().tool.notFromSubagent
  if ((action === "assign" || action === "appoint") && target?.observe === true) return w().tool.observing
  switch (action) {
    case "assign":
    case "appoint":
      if (rank !== "ceo") return w().tool.notCeo
      return target?.sessionId === me ? w().tool.notToSelf : undefined
    case "accept":
    case "reject":
      if (rank !== "ceo") return w().tool.notCeo
      if (job === undefined) return w().tool.noJob
      return job.status === "reported" ? undefined : w().tool.notReported
    case "track":
      return rank === "ceo" ? undefined : w().tool.notCeo
    case "amend":
      if (rank !== "ceo") return w().tool.notCeo
      if (job === undefined) return w().tool.noJob
      if (job.status === "reported") return w().tool.amendReported
      return job.status === "assigned" || job.status === "rejected" ? undefined : w().tool.closed
    case "withdraw":
      if (rank !== "ceo") return w().tool.notCeo
      if (job === undefined) return w().tool.noJob
      return OPEN.has(job.status) ? undefined : w().tool.closed
    case "title":
      // Its own, from any loop of the session; another's, as a head or the CEO.
      if (target === undefined || target.sessionId === me) return undefined
      if (ctx.isSubagent === true) return w().tool.notFromSubagent
      if (rank === "ceo") return undefined
      if (rank === "head") return target.project === ctx.myProject ? undefined : w().tool.otherRepo
      return w().tool.titleOwnOnly
    case "duty":
      if (rank === "staff") return w().tool.notManager
      return rank === "head" && target !== undefined && target.project !== ctx.myProject ? w().tool.otherRepo : undefined
    case "report":
      if (job === undefined) return w().tool.noJob
      if (job.to !== me) return w().tool.notYours
      return job.status === "assigned" || job.status === "rejected" ? undefined : w().tool.notOpen
    default:
      return undefined
  }
}

// The watchdog, code and not the CEO's model: open work that stalls is put to
// the CEO, which decides what to do (ask, hand it elsewhere, ask the head, tell
// the chairman). Rule 2 tells the chairman too, since only the chairman can
// approve a tool for another session.
export type Nudge = { id: string; rule: 1 | 2 | 3 | 4 | 5; minutes: number; toChairman: boolean }

export const WATCH = {
  everyMs: 30_000,
  idleMs: 10 * 60_000,
  approvalMs: 5 * 60_000,
  workingMs: 60 * 60_000,
  verdictMs: 10 * 60_000,
  againMs: 30 * 60_000,
  // Not the 30 s that draws a crab gone: a live session misses that many
  // heartbeats while its process stalls, and one did, put to the CEO as gone
  // home while its subagent worked. Gone is as long as the office takes to
  // drop a session.
  goneMs: LEAVE_MS,
}

// `nudged`: when each `<job>:<rule>` was last put to the CEO, so none comes
// twice in WATCH.againMs.
export function nudgesOf(jobs: Job[], snaps: Snapshot[], now: number, nudged: Record<string, number>): Nudge[] {
  const minutes = (ms: number) => Math.floor(ms / 60_000)
  const all = jobs.flatMap((job): Nudge[] => {
    const nudge = (rule: Nudge["rule"], since: number, toChairman = false): Nudge[] => [
      { id: job.id, rule, minutes: minutes(now - since), toChairman },
    ]
    if (job.status === "reported") return now - job.since > WATCH.verdictMs ? nudge(5, job.since) : []
    if (job.status !== "assigned" && job.status !== "rejected") return []
    const worker = snaps.find((s) => s.sessionId === job.to)
    if (worker === undefined || worker.ended === true || now - worker.updatedAt > WATCH.goneMs) return nudge(3, job.since)
    const { status, since } = worker.leader
    if (status === "approval") return now - since > WATCH.approvalMs ? nudge(2, since, true) : []
    return [
      ...(status === "idle" && since <= job.since && now - job.since > WATCH.idleMs ? nudge(1, job.since) : []),
      ...(now - job.since > WATCH.workingMs ? nudge(4, job.since) : []),
    ]
  })
  return all.filter((n) => now - (nudged[`${n.id}:${n.rule}`] ?? Number.NEGATIVE_INFINITY) >= WATCH.againMs)
}
