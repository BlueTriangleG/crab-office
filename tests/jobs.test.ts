import { expect, test } from "claude-code/testing"

import { REJECTS_MAX, WATCH, jobsOf, nudgesOf, refusalOf } from "../hooks/jobs.ts"
import type { Assignment, Job, Report, Verdict } from "../hooks/jobs.ts"
import { createSnapshot } from "../hooks/office.ts"
import { NO_ORG } from "../hooks/org.ts"
import { setLanguage } from "../hooks/words.ts"

setLanguage("zh")

const T0 = 1_000_000
const job = (id: string, to: string, at = T0): Assignment => ({ id, at, by: "a", to, task: "fix the login test" })
const report = (id: string, n: number, at: number): Report => ({ id, n, at, from: "b", text: "done" })
const verdict = (id: string, n: number, at: number, ok: boolean): Verdict => ({ id, n, at, by: "a", ok, note: "" })

test("a job's status follows its latest report or verdict, and a fourth reject goes to the chairman", async () => {
  const one = (reports: Report[], verdicts: Verdict[]) => jobsOf([job("j1", "b")], reports, verdicts)[0]
  expect(one([], [])?.status).toBe("assigned")
  expect(one([report("j1", 1, T0 + 1)], [])?.status).toBe("reported")
  expect(one([report("j1", 1, T0 + 1)], [verdict("j1", 1, T0 + 2, false)])?.status).toBe("rejected")
  const rounds = Array.from({ length: REJECTS_MAX + 1 }, (_, i) => i)
  const reports = rounds.map((i) => report("j1", i + 1, T0 + 10 * i + 1))
  const verdicts = rounds.map((i) => verdict("j1", i + 1, T0 + 10 * i + 2, false))
  expect(one(reports.slice(0, REJECTS_MAX), verdicts.slice(0, REJECTS_MAX))?.status).toBe("rejected")
  expect(one(reports, verdicts)?.status).toBe("chairman")
  // a report after a reject is waiting for a verdict again
  expect(one([report("j1", 1, T0 + 1), report("j1", 2, T0 + 3)], [verdict("j1", 1, T0 + 2, false)])?.status).toBe("reported")
  const accepted = one([report("j1", 1, T0 + 1)], [verdict("j1", 1, T0 + 5, true)])
  expect([accepted?.status, accepted?.since]).toEqual(["accepted", T0 + 5])
})

test("only the CEO assigns, judges and appoints; a head writes duties for its own repo; only the assignee reports", async () => {
  const a = createSnapshot("a", "web-app", undefined, T0)
  const b = createSnapshot("b", "web-app", undefined, T0, "docs")
  const c = createSnapshot("c", "api-server", undefined, T0)
  const ctx = { myProject: "web-app", org: NO_ORG }
  const as = (status: Job["status"], to = "b"): Job => ({ ...job("j1", to), status, since: T0, reports: [], verdicts: [] })
  expect(refusalOf("assign", "b", "staff", { ...ctx, target: c })).toBeDefined()
  expect(refusalOf("assign", "a", "ceo", { ...ctx, target: a })).toBeDefined()
  expect(refusalOf("assign", "a", "ceo", { ...ctx, target: b })).toBeUndefined()
  expect(refusalOf("duty", "h", "head", { ...ctx, target: c })).toBeDefined()
  expect(refusalOf("duty", "h", "head", { ...ctx, target: b })).toBeUndefined()
  expect(refusalOf("duty", "b", "staff", { ...ctx, target: b })).toBeDefined()
  expect(refusalOf("report", "c", "staff", { ...ctx, job: as("assigned") })).toBeDefined()
  expect(refusalOf("report", "b", "staff", { ...ctx, job: as("assigned") })).toBeUndefined()
  expect(refusalOf("report", "b", "staff", { ...ctx, job: as("rejected") })).toBeUndefined()
  for (const status of ["accepted", "chairman", "reported"] as const)
    expect(refusalOf("report", "b", "staff", { ...ctx, job: as(status) })).toBeDefined()
  expect(refusalOf("report", "b", "staff", ctx)).toBeDefined()
  expect(refusalOf("accept", "a", "ceo", { ...ctx, job: as("assigned") })).toBeDefined()
  expect(refusalOf("accept", "a", "ceo", { ...ctx, job: as("reported") })).toBeUndefined()
  expect(refusalOf("reject", "h", "head", { ...ctx, job: as("reported") })).toBeDefined()
  expect(refusalOf("appoint", "h", "head", { ...ctx, target: b })).toBeDefined()
  expect(refusalOf("appoint", "a", "ceo", { ...ctx, target: b })).toBeUndefined()
  expect(refusalOf("staff", "b", "staff", ctx)).toBeUndefined()
})

test("the watchdog: idle 10 min, waiting for approval 5 min, gone, working 60 min, unjudged 10 min, each at most once in 30 min", async () => {
  const worker = (id: string, status: string, since: number, updatedAt: number) => {
    const s = createSnapshot(id, "web-app", undefined, T0, id)
    s.leader.status = status as typeof s.leader.status
    s.leader.since = since
    s.updatedAt = updatedAt
    return s
  }
  const open = (id: string, to: string): Job => ({ ...job(id, to), status: "assigned", since: T0, reports: [], verdicts: [] })
  const rules = (jobs: Job[], snaps: ReturnType<typeof worker>[], now: number, nudged = {}) =>
    nudgesOf(jobs, snaps, now, nudged).map((n) => `${n.id}:${n.rule}`)
  // 1: idle since before the job
  const idle = worker("i", "idle", T0 - 1, T0 + WATCH.idleMs + 1)
  expect(rules([open("j", "i")], [idle], T0 + WATCH.idleMs + 1)).toEqual(["j:1"])
  expect(rules([open("j", "i")], [idle], T0 + WATCH.idleMs - 1)).toEqual([])
  // started after the job: not rule 1
  expect(rules([open("j", "i")], [worker("i", "idle", T0 + 5, T0 + WATCH.idleMs + 1)], T0 + WATCH.idleMs + 1)).toEqual([])
  // 2: waiting for approval, and it tells the chairman
  const asks = worker("p", "approval", T0 + 10, T0 + 10 + WATCH.approvalMs + 1)
  expect(nudgesOf([open("j", "p")], [asks], T0 + 10 + WATCH.approvalMs + 1, {})).toEqual([
    { id: "j", rule: 2, minutes: 5, toChairman: true },
  ])
  expect(rules([open("j", "p")], [asks], T0 + 10 + WATCH.approvalMs - 1)).toEqual([])
  // 3: the session has gone
  expect(rules([open("j", "x")], [], T0 + 1)).toEqual(["j:3"])
  // 4: working a long time with no report
  const busy = (now: number) => [worker("w", "editing", T0 + 5, now)]
  expect(rules([open("j", "w")], busy(T0 + WATCH.workingMs + 1), T0 + WATCH.workingMs + 1)).toEqual(["j:4"])
  expect(rules([open("j", "w")], busy(T0 + WATCH.workingMs - 1), T0 + WATCH.workingMs - 1)).toEqual([])
  // 5: reported and not judged
  const reported: Job = { ...open("j", "w"), status: "reported", since: T0 + 100 }
  expect(rules([reported], busy(T0 + 100 + WATCH.verdictMs + 1), T0 + 100 + WATCH.verdictMs + 1)).toEqual(["j:5"])
  expect(rules([reported], busy(T0 + 100 + WATCH.verdictMs - 1), T0 + 100 + WATCH.verdictMs - 1)).toEqual([])
  // once in 30 minutes
  const now = T0 + WATCH.idleMs + 1
  expect(rules([open("j", "i")], [idle], now, { "j:1": now - WATCH.againMs + 60_000 })).toEqual([])
  expect(rules([open("j", "i")], [idle], now, { "j:1": now - WATCH.againMs - 60_000 })).toEqual(["j:1"])
  // closed jobs never
  for (const status of ["accepted", "chairman"] as const)
    expect(rules([{ ...open("j", "x"), status }], [], T0 + WATCH.workingMs * 2)).toEqual([])
})

test("the CEO may withdraw an open job, which closes it and quiets the watchdog", async () => {
  const withdrawn = jobsOf([job("j1", "b")], [], [{ ...verdict("j1", 1, T0 + 5, false), isWithdrawn: true }])[0]
  expect(withdrawn?.status).toBe("withdrawn")
  expect(nudgesOf(withdrawn ? [withdrawn] : [], [], T0 + WATCH.workingMs * 2, {})).toEqual([])
  const ctx = { myProject: "web-app", org: NO_ORG }
  const as = (status: Job["status"]): Job => ({ ...job("j1", "b"), status, since: T0, reports: [], verdicts: [] })
  expect(refusalOf("withdraw", "a", "ceo", { ...ctx, job: as("assigned") })).toBeUndefined()
  expect(refusalOf("withdraw", "a", "ceo", { ...ctx, job: as("reported") })).toBeUndefined()
  expect(refusalOf("withdraw", "b", "staff", { ...ctx, job: as("assigned") })).toBeDefined()
  for (const status of ["accepted", "chairman", "withdrawn"] as const)
    expect(refusalOf("withdraw", "a", "ceo", { ...ctx, job: as(status) })).toBeDefined()
})

test("the CEO's subagents cannot act as the CEO", async () => {
  const b = createSnapshot("b", "web-app", undefined, T0, "docs")
  const ctx = { myProject: "web-app", org: NO_ORG, isSubagent: true }
  const reported: Job = { ...job("j1", "b"), status: "reported", since: T0, reports: [], verdicts: [] }
  for (const action of ["assign", "appoint", "duty"] as const)
    expect(refusalOf(action, "a", "ceo", { ...ctx, target: b })).toBeDefined()
  for (const action of ["accept", "reject", "withdraw"] as const)
    expect(refusalOf(action, "a", "ceo", { ...ctx, job: reported })).toBeDefined()
  // a subagent doing the job may still report it, and anyone may read the staff
  expect(refusalOf("report", "b", "staff", { ...ctx, job: { ...reported, status: "assigned" } })).toBeUndefined()
  expect(refusalOf("staff", "a", "ceo", ctx)).toBeUndefined()
})

test("a session sets its own job title; a head its repository's; the CEO anyone's", async () => {
  const b = createSnapshot("b", "web-app", undefined, T0, "docs")
  const c = createSnapshot("c", "api-server", undefined, T0)
  const ctx = { myProject: "web-app", org: NO_ORG }
  expect(refusalOf("title", "b", "staff", ctx)).toBeUndefined()
  expect(refusalOf("title", "b", "staff", { ...ctx, target: b })).toBeUndefined()
  expect(refusalOf("title", "x", "staff", { ...ctx, target: b })).toBeDefined()
  expect(refusalOf("title", "h", "head", { ...ctx, target: b })).toBeUndefined()
  expect(refusalOf("title", "h", "head", { ...ctx, target: c })).toBeDefined()
  expect(refusalOf("title", "a", "ceo", { ...ctx, target: c })).toBeUndefined()
  expect(refusalOf("title", "a", "ceo", { ...ctx, target: c, isSubagent: true })).toBeDefined()
})
