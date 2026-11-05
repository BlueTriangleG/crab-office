import { expect, test } from "claude-code/testing"

import { askOfLine, lineRefusal, linesOf } from "../hooks/lines.ts"
import type { Line } from "../hooks/lines.ts"
import { refusalOf } from "../hooks/jobs.ts"
import { NO_ORG } from "../hooks/org.ts"
import { setLanguage } from "../hooks/words.ts"

setLanguage("zh")

const T0 = 1_000_000
const line = (name: string, status: Line["status"], at: number, by = "c"): Line => ({ name, status, text: `${name} ${status}`, at, by })

test("the CEO's tracker: the latest word on each line still being worked, from any CEO's file, the most urgent first", async () => {
  const old = { "phoenix-down": line("phoenix-down", "ok", T0, "old-ceo") }
  const mine = {
    "phoenix-down": line("phoenix-down", "stuck", T0 + 5),
    onboarding: line("onboarding", "ok", T0 + 3),
    feedback: line("feedback", "waiting", T0 + 4),
    release: line("release", "risk", T0 + 2),
  }
  // waiting on the chairman is the chairman's board's, not the tracker's
  expect(linesOf([old, mine]).map((l) => `${l.name}:${l.status}`)).toEqual([
    "phoenix-down:stuck",
    "release:risk",
    "onboarding:ok",
  ])
  // a name in any case is one line
  expect(linesOf([mine, { "Phoenix-Down": line("Phoenix-Down", "ok", T0 + 9) }]).filter((l) => l.name.toLowerCase() === "phoenix-down")).toHaveLength(1)
})

test("a line done leaves the tracker at once", async () => {
  expect(linesOf([{ x: line("x", "done", T0) }])).toHaveLength(0)
})

test("a line waiting on the chairman goes onto the chairman's board as the CEO's question, naming the line", async () => {
  const d = askOfLine({ ...line("feedback", "waiting", T0), text: "等你说开工" }, "d9")
  expect(d).toEqual({ id: "d9", by: "c", at: T0, text: "feedback：等你说开工", line: "feedback" })
})

test("a line has a short title, a known status and a word on where it stands; only the CEO's own loop writes one", async () => {
  expect(lineRefusal("phoenix-down", "stuck", "查 ECS 事件")).toBeUndefined()
  // a title, in the chairman's own words, not a one-word name
  expect(lineRefusal("对话反馈", "ok", "x")).toBeUndefined()
  expect(lineRefusal("Onboarding 断点续上", "ok", "x")).toBeUndefined()
  expect(lineRefusal("字".repeat(25), "ok", "x")).toBeDefined()
  expect(lineRefusal("two\nlines", "ok", "x")).toBeDefined()
  expect(lineRefusal("  ", "ok", "x")).toBeDefined()
  expect(lineRefusal("x", "sideways", "x")).toBeDefined()
  expect(lineRefusal("x", "ok", "")).toBeDefined()
  // one short line: where it stands, not the whole story
  expect(lineRefusal("x", "ok", "字".repeat(40))).toBeUndefined()
  expect(lineRefusal("x", "ok", "字".repeat(41))).toBeDefined()
  const ctx = { myProject: "web-app", org: NO_ORG }
  expect(refusalOf("track", "c", "ceo", ctx)).toBeUndefined()
  expect(refusalOf("track", "b", "staff", ctx)).toBeDefined()
  expect(refusalOf("track", "c", "ceo", { ...ctx, isSubagent: true })).toBeDefined()
})
