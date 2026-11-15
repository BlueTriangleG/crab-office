import { expect, mock, test } from "claude-code/testing"
import type { TestBody } from "claude-code/testing"

import { createSnapshot } from "../hooks/office.ts"

const OFFICE = "/home/.claude/crab-office"
const BOARD = "mcp__crab-office__office_board"
const PRESENTATION = { isFullscreen: false, columns: 120 }

type Seed = (files: Map<string, string>, now: number) => void

// An office on an in-memory disk: this session "a" (titled manager) and a
// colleague "c" titled voice, both in web-app. What sessions are sent, and what
// this one is prompted with, are kept.
async function start($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], seed: Seed = () => {}) {
  const files = new Map<string, string>()
  const submitted: string[] = []
  const sent: { to: unknown; text: string }[] = []
  const prompt = { text: "" }
  on("prompt.read", () => ({ value: { text: prompt.text, cursor: 0 } }))
  on("prompt.submit", (_, e) => (submitted.push(e.text), { text: e.text }))
  on("session.send", (_, e) => (sent.push({ to: e.to, text: e.text }), { isDelivered: true }))
  on("session.id", () => ({ value: "a" }))
  // The tool itself, beneath the mod: whatever the mod lets through runs.
  on("tool.call", () => ({ result: "ran" }))
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
  const a = createSnapshot("a", "web-app", undefined, now - 60_000)
  a.themeSeen = "en|"
  files.set(`${OFFICE}/live/a.json`, JSON.stringify(a))
  const c = createSnapshot("c", "web-app", undefined, now)
  files.set(`${OFFICE}/live/c.json`, JSON.stringify(c))
  files.set(`${OFFICE}/titles/c.json`, JSON.stringify({ c: { text: "voice", at: now, by: "c" }, a: { text: "manager", at: now, by: "a" } }))
  seed(files, now)
  await $.session.start({ cwd: "/work/web-app", surface: "terminal", isInteractive: true })
  await clock.advance(1000)
  const run = (args: string) => $.command.run({ command: "office", args, origin: { kind: "composer" }, presentation: PRESENTATION })
  return { files, submitted, sent, prompt, clock, run }
}

const appointed = (kind: "ambassador" | "ceo", sessionId: string, briefed: boolean): Seed => (files, now) => {
  const mine = JSON.parse(files.get(`${OFFICE}/org/a.json`) ?? "[]") as unknown[]
  files.set(`${OFFICE}/org/a.json`, JSON.stringify([...mine, { kind, sessionId, at: now - 1, by: "chairman" }]))
  if (sessionId !== "a") return
  const a = JSON.parse(files.get(`${OFFICE}/live/a.json`) ?? "{}") as Record<string, unknown>
  files.set(`${OFFICE}/live/a.json`, JSON.stringify({ ...a, ...(briefed ? { ambassadorSeen: now - 1, ceoSeen: now - 1 } : {}) }))
}
const both = (...seeds: Seed[]): Seed => (files, now) => seeds.forEach((s) => s(files, now))
const said = (r: unknown) => JSON.stringify(r)

test("the chairman makes a session ambassador, and is told what it gives up", async ($, on) => {
  const { files, run } = await start($, on)
  const r = await run("ambassador voice")
  expect(said(r)).toContain("is Ambassador now")
  expect(said(r)).toContain("cannot edit files")
  const records = JSON.parse(files.get(`${OFFICE}/org/a.json`) ?? "[]") as { kind: string; sessionId: string }[]
  expect(records).toContainEqual(expect.objectContaining({ kind: "ambassador", sessionId: "c" }))
  expect(said(await run("ambassador off"))).toContain("is no longer Ambassador")
})

test("the CEO cannot be ambassador, nor the ambassador CEO", async ($, on) => {
  const first = await start($, on, appointed("ceo", "a", true))
  expect(said(await first.run("ambassador manager"))).toContain("cannot be the ambassador as well")
})

test("the ambassador cannot be made CEO", async ($, on) => {
  const { run } = await start($, on, appointed("ambassador", "c", true))
  expect(said(await run("ceo voice"))).toContain("cannot be CEO as well")
})

test("the ambassador is briefed once per appointment, when free", async ($, on) => {
  const { submitted, clock } = await start($, on, appointed("ambassador", "a", false))
  await clock.advance(5000)
  expect(submitted.filter((t) => t.includes("You are now this office's ambassador"))).toHaveLength(1)
})

test("a briefing on an earlier appointment does not count for a new one", async ($, on) => {
  const { submitted } = await start($, on, (files, now) => {
    appointed("ambassador", "a", false)(files, now)
    const a = JSON.parse(files.get(`${OFFICE}/live/a.json`) ?? "{}") as Record<string, unknown>
    files.set(`${OFFICE}/live/a.json`, JSON.stringify({ ...a, ambassadorSeen: now - 3_600_000 }))
  })
  expect(submitted.filter((t) => t.includes("You are now this office's ambassador"))).toHaveLength(1)
})

test("in the ambassador's session only reading and asking get through, for its subagents too", async ($, on) => {
  await start($, on, appointed("ambassador", "a", true))
  const edit = { tool: "Edit", file_path: "/work/web-app/a.ts", old_string: "a", new_string: "b" }
  expect(said(await $.tool.call(edit as never))).toContain("The ambassador's session cannot use Edit")
  expect(said(await $.tool.call({ ...edit, agentId: "sub1" } as never))).toContain("The ambassador's session cannot use Edit")
  expect(said(await $.tool.call({ tool: "Bash", command: "ls" } as never))).toContain("cannot use Bash")
  expect(said(await $.tool.call({ tool: "Read", file_path: "/work/web-app/a.ts" } as never))).not.toContain("ambassador")
  expect(said(await $.tool.call({ tool: "Read", file_path: "/home/.ssh/id_ed25519" } as never))).toContain("cannot read")
  expect(said(await $.tool.call({ tool: BOARD, action: "assign", to: "voice", text: "write their parser" } as never))).toContain("cannot use office_board assign")
})

test("a session that is not ambassador is not limited", async ($, on) => {
  await start($, on, appointed("ambassador", "c", true))
  const edit = { tool: "Edit", file_path: "/work/web-app/a.ts", old_string: "a", new_string: "b" }
  expect(said(await $.tool.call(edit as never))).not.toContain("ambassador")
})

test("the ambassador's question to a colleague says it comes from outside", async ($, on) => {
  const { sent } = await start($, on, appointed("ambassador", "a", true))
  await $.tool.call({ tool: "SendMessage", to: "voice", message: "is user_id required in the export?" } as never)
  expect(sent).toHaveLength(1)
  expect(sent[0]?.text.startsWith("[Asked from outside")).toBe(true)
  expect(sent[0]?.text).toContain("is user_id required in the export?")
})
