import { expect, test } from "claude-code/testing"

import { REJECTS_MAX, jobsOf, refusalOf } from "../hooks/jobs.ts"
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
