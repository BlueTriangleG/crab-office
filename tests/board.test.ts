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
