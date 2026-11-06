import type { On } from "claude-code"
import { expect, mock, test } from "claude-code/testing"

const LIVE = "/home/me/.claude/crab-office/live"

// A session in an office folder kept in memory, whose id the test moves on as
// a /resume or /clear does.
function sessionOf(on: On) {
  const clock = mock.clock(on)
  mock.env(on, { HOME: "/home/me" })
  const state = { id: "first" }
  on("session.id", () => ({ value: state.id }))
  const files = new Map<string, string>()
  on("fs.write", (_, e) => (files.set(e.path, e.text), { value: undefined }))
  on("fs.read", (_, e, next) => (files.has(e.path) ? { value: files.get(e.path)! } : next(e)))
  on("fs.list", () => ({ value: [] }))
  on("command.register", (_, e) => ({ value: { command: e.name } }))
  on("tool.register", (_, e) => ({ value: { tool: e.name } }))
  on("session.start", (_, e) => ({ cwd: e.cwd }))
  on("session.end", (_, e) => ({ sessionId: e.sessionId }))
  const live = (sessionId: string) => {
    const text = files.get(`${LIVE}/${sessionId}.json`)
    return text === undefined ? undefined : (JSON.parse(text) as { sessionId: string; ended?: boolean })
  }
  return { clock, state, live }
}

for (const reason of ["resume", "clear"] as const) {
  test(`after a /${reason} the process joins the office as the session that took its place`, async ($, on) => {
    const { clock, state, live } = sessionOf(on)
    await $.session.start({ cwd: "/work/web-app", surface: "terminal", isInteractive: true })
    await clock.advance(1000)
    expect(live("first")?.sessionId).toBe("first")
    expect(live("first")?.ended).toBeUndefined()

    await $.session.end({ reason, sessionId: "first", resume: { id: "first" } })
    expect(live("first")?.ended).toBe(true)
    // Until the process answers to the next id, the ended session keeps still.
    await clock.advance(1000)
    expect(live("first")?.ended).toBe(true)
    expect(live("second")).toBeUndefined()

    state.id = "second"
    await clock.advance(1000)
    expect(live("first")?.ended).toBe(true)
    expect(live("second")?.sessionId).toBe("second")
    expect(live("second")?.ended).toBeUndefined()
  })
}

test("a session that exits stops its heartbeat and stays ended", async ($, on) => {
  const { clock, state, live } = sessionOf(on)
  await $.session.start({ cwd: "/work/web-app", surface: "terminal", isInteractive: true })
  await clock.advance(1000)
  expect(live("first")?.ended).toBeUndefined()

  await $.session.end({ reason: "prompt_input_exit", sessionId: "first", resume: { id: "first" } })
  state.id = "second"
  await clock.advance(10_000)
  expect(live("first")?.ended).toBe(true)
  expect(live("second")).toBeUndefined()
})
