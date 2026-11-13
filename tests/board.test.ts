import { expect, mock, test } from "claude-code/testing"
import type { TestBody } from "claude-code/testing"

import { createSnapshot } from "../hooks/office.ts"

const OFFICE = "/home/.claude/crab-office"
const BOARD = "mcp__crab-office__office_board"

// An office on an in-memory disk: this session "a" and a colleague "c" titled
// voice, both in web-app, and an open memo "o" that "a" claimed by mistake.
async function office($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], seed: (files: Map<string, string>, now: number) => void = () => {}) {
  const files = new Map<string, string>()
  const submitted: string[] = []
  on("prompt.read", () => ({ value: { text: "", cursor: 0 } }))
  on("prompt.submit", (_, e) => (submitted.push(e.text), { text: e.text }))
  on("session.id", () => ({ value: "a" }))
  on("fs.write", (_, e) => (files.set(e.path, e.text), { value: undefined }))
  on("fs.read", (_, e) => {
    const text = files.get(e.path)
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)
    return { value: text }
  })
  on("fs.list", (_, e) => ({
    value: [...files.keys()]
      .filter((p) => p.startsWith(`${e.path}/`) && !p.slice(e.path.length + 1).includes("/"))
      .map((p) => ({ name: p.slice(e.path.length + 1), kind: "file" as const, size: 0, mtimeMs: Date.now(), isLink: false })),
  }))
  on("command.register", (_, e) => ({ value: { command: e.name } }))
  on("tool.register", (_, e) => ({ value: { tool: e.name } }))
  mock.env(on, { HOME: "/home" })
  const clock = mock.clock(on)
  on("session.start", (_, e) => ({ cwd: e.cwd }))
  const now = Date.now()
  const c = createSnapshot("c", "web-app", undefined, now)
  files.set(`${OFFICE}/live/c.json`, JSON.stringify(c))
  files.set(`${OFFICE}/titles/c.json`, JSON.stringify({ c: { text: "voice", at: now, by: "c" } }))
  files.set(`${OFFICE}/memos/o.json`, JSON.stringify({ id: "o", at: now, text: "how long does a dropped call wait", to: { kind: "open" } }))
  files.set(`${OFFICE}/claims/o.json`, JSON.stringify({ memoId: "o", at: now, sessionId: "a", who: "web-app" }))
  seed(files, now)
  await $.session.start({ cwd: "/work/web-app", surface: "terminal", isInteractive: true })
  await clock.advance(1000)
  return { files, submitted, clock }
}

test("a memo passed to a colleague by job title is handed to them next, and lets go of the passer's claim", async ($, on) => {
  const { files } = await office($, on)
  const r = await $.tool.call({ tool: BOARD, action: "pass", memo: "o", to: "voice", text: "calls are voice's" })
  expect(JSON.stringify(r)).toContain("Passed to")
  expect(JSON.stringify(r)).toContain("voice")
  const passed = JSON.parse(files.get(`${OFFICE}/passes/o.a.json`) ?? "null") as { to?: string } | null
  expect(passed?.to).toBe("c")
  const claim = JSON.parse(files.get(`${OFFICE}/claims/o.json`) ?? "null") as { passedAt?: number } | null
  expect(claim?.passedAt).toBeDefined()
})

test("a post's receipt names each colleague who will read it by job title", async ($, on) => {
  await office($, on)
  const r = await $.tool.call({ tool: BOARD, action: "post", to: "web-app", text: "hello" })
  expect(JSON.stringify(r)).toContain("voice")
})

// The session's own snapshot as an earlier load of the mod left it: given work,
// and asked or not. A reload starts the module over and reads only this.
const before = (asked: boolean) => (files: Map<string, string>, now: number) => {
  const a = createSnapshot("a", "web-app", undefined, now - 60_000)
  a.leader.title = "fix the login test"
  if (asked) a.askedName = true
  files.set(`${OFFICE}/live/a.json`, JSON.stringify(a))
}

test("a session given work before a reload, with no job title, is asked once to name itself", async ($, on) => {
  const { submitted, clock } = await office($, on, before(false))
  await clock.advance(1000)
  expect(submitted.filter((t) => t.includes("name yourself"))).toHaveLength(1)
})

test("a session already asked is not asked again after a reload", async ($, on) => {
  const { submitted, clock } = await office($, on, before(true))
  await clock.advance(1000)
  expect(submitted.filter((t) => t.includes("name yourself"))).toHaveLength(0)
})

// This session "a" as CEO, already handed over, with no memo of its own to take,
// and two jobs given colleague "c" two hours ago: c, idle a minute, has not
// reported, so the watchdog would ask after both.
const asCeo = (files: Map<string, string>, now: number) => {
  files.delete(`${OFFICE}/memos/o.json`)
  files.delete(`${OFFICE}/claims/o.json`)
  files.set(`${OFFICE}/org/a.json`, JSON.stringify([{ kind: "ceo", sessionId: "a", at: now - 1, by: "chairman" }]))
  const a = createSnapshot("a", "web-app", undefined, now - 60_000)
  a.ceoSeen = now - 1
  a.themeSeen = "en|"
  files.set(`${OFFICE}/live/a.json`, JSON.stringify(a))
  const c = createSnapshot("c", "web-app", undefined, now - 60_000)
  c.leader.since = now - 60_000
  files.set(`${OFFICE}/live/c.json`, JSON.stringify(c))
  for (const id of ["j1", "j2"])
    files.set(`${OFFICE}/jobs/${id}.json`, JSON.stringify({ id, at: now - 2 * 3_600_000, by: "a", to: "c", task: `job ${id}` }))
}

// The CEO's report is the whole picture each time, so it replaces the one
// before: the section under the office is kept up, not piled up.
test("the CEO's word to the chairman replaces the latest update under the office", async ($, on) => {
  const { files } = await office($, on, asCeo)
  const kept = () => JSON.parse(files.get(`${OFFICE}/update.json`) ?? "null") as Record<string, unknown> | null
  await $.tool.call({ tool: BOARD, action: "post", text: "the login fix is under review" })
  await $.tool.call({ tool: BOARD, action: "post", text: "the login fix is merged" })
  expect(kept()).toMatchObject({ by: "a", text: "the login fix is merged" })
  // one to colleagues is theirs, not the chairman's news
  await $.tool.call({ tool: BOARD, action: "post", to: "web-app", text: "hello" })
  expect(kept()?.text).toBe("the login fix is merged")
})

test("a session that is not CEO writes to the chairman on the board alone", async ($, on) => {
  const { files } = await office($, on)
  await $.tool.call({ tool: BOARD, action: "post", text: "hello chairman" })
  expect(files.has(`${OFFICE}/update.json`)).toBe(false)
})

const PANE_PROPS = { title: "office", isFocused: true, bodyColumns: 160, placement: "dock" as const, scroll: { offset: 0, bodyRows: 200 }, view: {} }

test("the latest update sits under the CEO's tracker, past a week, until the chairman clears it", async ($, on) => {
  const { files, clock } = await office($, on, (files, now) => {
    asCeo(files, now)
    files.set(`${OFFICE}/update.json`, JSON.stringify({ id: "u", at: now - 30 * 86_400_000, by: "a", text: "all on track" }))
  })
  const ui = await $.ui.mount({ plugin: "crab-office", surface: "terminal", component: "Pane", requestId: "crab-office", props: PANE_PROPS })
  // Box and Text keep no key once drawn, so each card is found by what it says.
  const top = await ui.drawn()
  const cards = ("children" in top && Array.isArray(top.children) ? top.children : []).map((c: unknown) => JSON.stringify(c))
  expect(cards.findIndex((c) => c.includes("all on track"))).toBe(cards.findIndex((c) => c.includes("CEO's tracker")) + 1)
  expect(await ui.find({ type: "Text", text: /all on track/ })).toBeDefined()
  await ui.press({ key: "office-updates-clear" })
  expect(JSON.parse(files.get(`${OFFICE}/update.json`) ?? "{}")).toBeNull()
  await clock.advance(1000)
  await ui.redraw(PANE_PROPS)
  expect(await ui.find({ type: "Text", text: /all on track/ })).toBeUndefined()
  await ui.unmount()
})

test("the CEO marks a job waiting on something, kept with what the job and its session were, and takes the mark off", async ($, on) => {
  const { files } = await office($, on, asCeo)
  const c = JSON.parse(files.get(`${OFFICE}/live/c.json`) ?? "{}") as { leader: { since: number } }
  const job = JSON.parse(files.get(`${OFFICE}/jobs/j1.json`) ?? "{}") as { at: number }
  const r = await $.tool.call({ tool: BOARD, action: "wait", assignment: "j1", text: "the chairman" })
  expect(JSON.stringify(r)).toContain("the chairman")
  const mark = JSON.parse(files.get(`${OFFICE}/waits/j1.json`) ?? "null") as Record<string, unknown> | null
  expect(mark).toMatchObject({ id: "j1", by: "a", text: "the chairman", jobSince: job.at, amends: 0, workerSince: c.leader.since })
  await $.tool.call({ tool: BOARD, action: "wait", assignment: "j1" })
  expect((JSON.parse(files.get(`${OFFICE}/waits/j1.json`) ?? "{}") as { text?: string }).text).toBe("")
})

test("the watchdog leaves a job marked waiting, and asks after one whose wait has ended, saying what it waited on", async ($, on) => {
  const { submitted } = await office($, on, (files, now) => {
    asCeo(files, now)
    const at = now - 2 * 3_600_000
    // j1's session has not moved since; j2's had started something since its mark
    files.set(`${OFFICE}/waits/j1.json`, JSON.stringify({ id: "j1", at: now - 5 * 60_000, by: "a", text: "the chairman", jobSince: at, amends: 0, workerSince: now - 60_000 }))
    files.set(`${OFFICE}/waits/j2.json`, JSON.stringify({ id: "j2", at: now - 5 * 60_000, by: "a", text: "a review", jobSince: at, amends: 0, workerSince: now - 90 * 60_000 }))
  })
  const nudges = submitted.filter((t) => t.includes("watchdog"))
  expect(nudges).toHaveLength(1)
  expect(nudges[0]).toContain("#j2")
  expect(nudges[0]).toContain("a review")
  expect(nudges[0]).not.toContain("#j1")
})
