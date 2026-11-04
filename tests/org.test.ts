import { expect, test } from "claude-code/testing"

import { LEAVE_MS, chairman, chiefsOf, companyOf, createSnapshot } from "../hooks/office.ts"
import {
  NO_ORG,
  appointedNote,
  ceoHandoverOf,
  dutiesOf,
  orgOf,
  parseAppoint,
  prunedRecords,
  roleSectionOf,
  sessionNamed,
  staffOf,
} from "../hooks/org.ts"
import { jobsOf } from "../hooks/jobs.ts"
import type { Appointment } from "../hooks/org.ts"
import { titleOf } from "../hooks/pixels.ts"
import { setLanguage } from "../hooks/words.ts"

setLanguage("zh")

const T0 = 1_000_000

test("the chairman's latest CEO stands until revoked or gone", async () => {
  const a = createSnapshot("a", "web-app", undefined, T0)
  const b = createSnapshot("b", "api-server", undefined, T0)
  for (const s of [a, b]) s.updatedAt = T0
  const ceo = (sessionId: string | null, at: number): Appointment => ({ kind: "ceo", sessionId, at, by: "chairman" })
  expect(orgOf([ceo("a", T0), ceo("b", T0 + 5)], [a, b], T0 + 10).ceo).toBe("b")
  // two writers' files, read in either order: the latest stands
  expect(orgOf([ceo("b", T0 + 5), ceo("a", T0 + 1)], [a, b], T0 + 10).ceo).toBe("b")
  expect(orgOf([ceo("a", T0), ceo(null, T0 + 5)], [a, b], T0 + 10).ceo).toBeUndefined()
  // gone from the company, the appointment lapses
  expect(orgOf([ceo("a", T0)], [a, b], T0 + LEAVE_MS).ceo).toBeUndefined()
})

test("a department's 部长: the chairman's pick, else the CEO's, else the longest-serving, never the CEO", async () => {
  const hq = createSnapshot("a", "web-app", undefined, T0)
  const wt = createSnapshot("b", "web-app", undefined, T0 + 1, "docs")
  const wt2 = createSnapshot("c", "web-app", undefined, T0 + 2, "auth")
  for (const s of [hq, wt, wt2]) s.updatedAt = T0 + 10
  const snaps = [hq, wt, wt2]
  const head = (sessionId: string | null, at: number, by: Appointment["by"]): Appointment => ({
    kind: "head",
    project: "web-app",
    sessionId,
    at,
    by,
  })
  expect([...chiefsOf(snaps, T0 + 10)]).toEqual(["a"])
  const ceoIsA: Appointment = { kind: "ceo", sessionId: "a", at: T0, by: "chairman" }
  expect([...chiefsOf(snaps, T0 + 10, orgOf([ceoIsA], snaps, T0 + 10))]).toEqual(["b"])
  expect([...chiefsOf(snaps, T0 + 10, orgOf([ceoIsA, head("c", T0 + 3, "ceo")], snaps, T0 + 10))]).toEqual(["c"])
  const both = [ceoIsA, head("b", T0 + 2, "chairman"), head("c", T0 + 3, "ceo")]
  expect([...chiefsOf(snaps, T0 + 10, orgOf(both, snaps, T0 + 10))]).toEqual(["b"])
  // the chairman's revoke clears every pick made before it, the CEO's too
  expect([...chiefsOf(snaps, T0 + 10, orgOf([...both, head(null, T0 + 4, "chairman")], snaps, T0 + 10))]).toEqual(["b"])
  // and the CEO may appoint again after it
  const again = [...both, head(null, T0 + 4, "chairman"), head("c", T0 + 5, "ceo")]
  expect([...chiefsOf(snaps, T0 + 10, orgOf(again, snaps, T0 + 10))]).toEqual(["c"])
  // nobody may be both
  expect([...chiefsOf(snaps, T0 + 10, orgOf([ceoIsA, head("a", T0 + 3, "chairman")], snaps, T0 + 10))]).toEqual(["b"])
})

test("the CEO wears its own hat and title; a 部长 the crown; everyone else is 组长", async () => {
  const a = createSnapshot("a", "web-app", undefined, T0)
  const b = createSnapshot("b", "web-app", undefined, T0 + 1, "docs")
  const d = createSnapshot("d", "web-app", undefined, T0 + 2)
  const c = createSnapshot("c", "api-server", undefined, T0 + 3)
  const snaps = [a, b, d, c]
  for (const s of snaps) s.updatedAt = T0 + 10
  const org = orgOf([{ kind: "ceo", sessionId: "a", at: T0, by: "chairman" }], snaps, T0 + 10)
  const seats = companyOf(snaps, "a", T0 + 10, { memos: [], claims: [], org }).rooms.flatMap((r) => r.teams.flat())
  const at = (id: string) => seats.find((s) => s.id === id)
  expect([at("a")?.role, at("a")?.hat]).toEqual(["ceo", "ceo"])
  // the checkout's next session heads web-app once its longest-serving is CEO
  expect(at("d")?.role).toBe("chief")
  expect(at("b")?.role).toBe("lead")
  expect(at("c")?.role).toBe("chief")
  expect(["ceo", "chief", "lead"].map(titleOf)).toEqual(["CEO", "部长", "组长"])
})

test("/office ceo and /office head name a session or say off", async () => {
  expect(parseAppoint("ceo @docs")).toEqual({ kind: "ceo", name: "docs", isOff: false })
  expect(parseAppoint("ceo off")).toEqual({ kind: "ceo", name: null, isOff: true })
  expect(parseAppoint("head @api-server-e0")).toEqual({ kind: "head", name: "api-server-e0", isOff: false })
  expect(parseAppoint("head off @web-app")).toEqual({ kind: "head", name: "web-app", isOff: true })
  expect(parseAppoint("head off")).toEqual({ kind: "head", name: null, isOff: true })
  expect(parseAppoint("ceo")).toBeUndefined()
  expect(parseAppoint("say hi")).toBeUndefined()
})

test("a name that fits two sessions names neither", async () => {
  const a = createSnapshot("a", "web-app", undefined, T0, "docs")
  const b = createSnapshot("b", "web-app", undefined, T0, "docs")
  const c = createSnapshot("c", "api-server", undefined, T0)
  for (const s of [a, b, c]) s.updatedAt = T0
  const snaps = [a, b, c]
  const peers = [{ sessionId: "c", name: "api-server-e0" }]
  const docs = sessionNamed("docs", snaps, peers, T0)
  expect(docs.one).toBeUndefined()
  expect(docs.many.map((s) => s.sessionId).sort()).toEqual(["a", "b"])
  expect(sessionNamed("api-server-e0", snaps, peers, T0).one?.sessionId).toBe("c")
  expect(sessionNamed("@本部", snaps, peers, T0).one?.sessionId).toBe("c")
  expect(sessionNamed("api-server 部 · 本部", snaps, peers, T0).one?.sessionId).toBe("c")
  expect(sessionNamed("nobody", snaps, peers, T0).many).toEqual([])
})

test("an appointment is a line on the board naming who and what", async () => {
  const a = createSnapshot("a", "web-app", undefined, T0)
  const b = createSnapshot("b", "api-server", undefined, T0)
  for (const s of [a, b]) s.updatedAt = T0
  const made = appointedNote(chairman(), b, "ceo", false, T0 + 1)
  expect([made.kind, made.from.name, made.to.id, made.text]).toEqual(["message", "董事长", "b", "任命为 CEO"])
  expect(appointedNote(chairman(), b, "head", true, T0 + 2).text).toBe("撤销部长")
  // written where the chairman clicked, it names the session it is about
  a.board = [made]
  expect(companyOf([a, b], "a", T0 + 3).board?.at(-1)?.to.name).toContain("api-server 部 · 本部")
})

test("duties: the latest word on each session wins", async () => {
  const fromCeo = { b: { text: "auth and login", at: T0 + 5, by: "a" }, c: { text: "the api", at: T0, by: "a" } }
  const fromHead = { b: { text: "docs only", at: T0 + 1, by: "h" }, c: { text: "the api and its tests", at: T0 + 9, by: "h" } }
  expect(dutiesOf([fromCeo, fromHead])).toEqual({ b: "auth and login", c: "the api and its tests" })
})

test("staff lists each present session with its SendMessage name, rank, duty and open jobs", async () => {
  const a = createSnapshot("a", "web-app", undefined, T0)
  const b = createSnapshot("b", "web-app", undefined, T0 + 1, "docs")
  const c = createSnapshot("c", "api-server", undefined, T0 + 2)
  const gone = createSnapshot("g", "api-server", undefined, T0 + 3, "old")
  for (const s of [a, b, c]) s.updatedAt = T0 + 10
  gone.updatedAt = T0 - LEAVE_MS
  const snaps = [a, b, c, gone]
  const org = orgOf([{ kind: "ceo", sessionId: "a", at: T0, by: "chairman" }], snaps, T0 + 10)
  const jobs = jobsOf([{ id: "j1", at: T0, by: "a", to: "b", task: "fix the login test" }], [], [])
  const peers = [{ sessionId: "b", name: "web-app-8b" }]
  const lines = staffOf(snaps, a, org, { b: "auth and login" }, jobs, peers, T0 + 10)
  expect(lines).toHaveLength(3)
  const line = (who: string) => lines.find((l) => l.includes(who)) ?? ""
  expect(line("web-app 部 · 本部")).toContain("CEO")
  expect(line("web-app 部 · docs")).toContain("部长")
  expect(line("web-app 部 · docs")).toContain("web-app-8b")
  expect(line("web-app 部 · docs")).toContain("auth and login")
  expect(line("web-app 部 · docs")).toContain("#j1")
  expect(line("api-server 部 · 本部")).toContain("部长")
})

const company = () => {
  const a = createSnapshot("a", "web-app", undefined, T0)
  const b = createSnapshot("b", "web-app", undefined, T0 + 1, "docs")
  const c = createSnapshot("c", "api-server", undefined, T0 + 2)
  const snaps = [a, b, c]
  for (const s of snaps) s.updatedAt = T0 + 10
  const org = orgOf([{ kind: "ceo", sessionId: "c", at: T0, by: "chairman" }], snaps, T0 + 10)
  const peers = [
    { sessionId: "c", name: "api-server-e0" },
    { sessionId: "a", name: "web-app-8b" },
  ]
  return { a, b, c, snaps, org, peers }
}

test("each rank is told who the CEO is and what it may do", async () => {
  const { a, b, c, snaps, org, peers } = company()
  expect(roleSectionOf("staff", b, snaps, NO_ORG, peers, T0 + 10)).toBeUndefined()
  const ceo = roleSectionOf("ceo", c, snaps, org, peers, T0 + 10) ?? ""
  expect(ceo).toContain("assign")
  expect(ceo).toContain("accept")
  // the same a minute on, so the prompt's cache holds until an appointment changes
  expect(roleSectionOf("ceo", c, snaps, org, peers, T0 + 70_000)).toBe(ceo)
  const head = roleSectionOf("head", a, snaps, org, peers, T0 + 10) ?? ""
  expect(head).toContain("duty")
  expect(head).toContain("web-app")
  expect(head).toContain("api-server-e0")
  const staff = roleSectionOf("staff", b, snaps, org, peers, T0 + 10) ?? ""
  expect(staff).toContain("api-server-e0")
  expect(staff).toContain("report")
  // and who heads its own repository
  expect(staff).toContain("web-app-8b")
})

test("the CEO's handover lists reports waiting for a verdict", async () => {
  const { b, c, snaps, org, peers } = company()
  const jobs = jobsOf(
    [
      { id: "j1", at: T0, by: "c", to: "b", task: "fix the login test" },
      { id: "j2", at: T0, by: "c", to: "b", task: "write the docs" },
    ],
    [
      { id: "j1", n: 1, at: T0 + 1, from: "b", text: "fixed" },
      { id: "j2", n: 1, at: T0 + 1, from: "b", text: "written" },
    ],
    [{ id: "j2", n: 1, at: T0 + 2, by: "c", ok: true, note: "" }],
  )
  const text = ceoHandoverOf(c, snaps, org, jobs, {}, peers, T0 + 10)
  expect(text).toContain("#j1")
  expect(text).not.toContain("#j2")
  expect(text).toContain(b.team ?? "")
  expect(text).toContain("staff")
  // the whole of a CEO's instructions, since another plugin may keep the
  // system prompt's section from ever being added
  expect(text).toContain("assign")
  expect(text).toContain("withdraw")
  expect(text).toContain("accept")
})

test("pruning keeps the latest appointment of each kind, repository and appointer", async () => {
  const ceo: Appointment = { kind: "ceo", sessionId: "a", at: T0, by: "chairman" }
  const heads = Array.from({ length: 30 }, (_, i): Appointment => ({
    kind: "head",
    project: `p${i % 3}`,
    sessionId: `s${i}`,
    at: T0 + 1 + i,
    by: "ceo",
  }))
  const kept = prunedRecords([ceo, ...heads])
  expect(kept).toContainEqual(ceo)
  expect(kept.filter((r) => r.kind === "head").map((r) => r.sessionId).sort()).toEqual(["s27", "s28", "s29"])
})

test("a team whose name ends in team is still that team", async () => {
  const s = createSnapshot("a", "web-app", undefined, T0, "dreamteam")
  s.updatedAt = T0
  expect(sessionNamed("dreamteam", [s], [], T0).one?.sessionId).toBe("a")
  expect(sessionNamed("dreamteam team", [s], [], T0).one?.sessionId).toBe("a")
  expect(sessionNamed("dreamteam组", [s], [], T0).one?.sessionId).toBe("a")
})
