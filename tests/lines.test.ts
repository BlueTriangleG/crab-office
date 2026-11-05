import { expect, test } from "claude-code/testing"

import { LINE_DONE_KEEP_MS, lineRefusal, linesOf } from "../hooks/lines.ts"
import type { Line } from "../hooks/lines.ts"
import { refusalOf } from "../hooks/jobs.ts"
import { NO_ORG } from "../hooks/org.ts"
import { setLanguage } from "../hooks/words.ts"

setLanguage("zh")

const T0 = 1_000_000
const line = (name: string, status: Line["status"], at: number, by = "c"): Line => ({ name, status, text: `${name} ${status}`, at, by })

test("the CEO's tracker: the latest word on each line, from any CEO's file, the most urgent first", async () => {
  const old = { "phoenix-down": line("phoenix-down", "ok", T0, "old-ceo") }
  const mine = {
    "phoenix-down": line("phoenix-down", "stuck", T0 + 5),
    onboarding: line("onboarding", "ok", T0 + 3),
    feedback: line("feedback", "waiting", T0 + 4),
    release: line("release", "risk", T0 + 2),
  }
  expect(linesOf([old, mine], T0 + 10).map((l) => `${l.name}:${l.status}`)).toEqual([
    "phoenix-down:stuck",
    "feedback:waiting",
    "release:risk",
    "onboarding:ok",
  ])
  // a name in any case is one line
  expect(linesOf([mine, { "Phoenix-Down": line("Phoenix-Down", "ok", T0 + 9) }], T0 + 10).filter((l) => l.name.toLowerCase() === "phoenix-down")).toHaveLength(1)
})

test("a line done stays a day, then folds away", async () => {
  const files = [{ x: line("x", "done", T0) }]
  expect(linesOf(files, T0 + LINE_DONE_KEEP_MS - 1)).toHaveLength(1)
  expect(linesOf(files, T0 + LINE_DONE_KEEP_MS + 1)).toHaveLength(0)
})

test("a line is one word with a known status and a word on where it stands; only the CEO's own loop writes one", async () => {
  expect(lineRefusal("phoenix-down", "stuck", "查 ECS 事件")).toBeUndefined()
  expect(lineRefusal("two words", "stuck", "x")).toBeDefined()
  expect(lineRefusal("x", "sideways", "x")).toBeDefined()
  expect(lineRefusal("x", "ok", "")).toBeDefined()
  const ctx = { myProject: "web-app", org: NO_ORG }
  expect(refusalOf("track", "c", "ceo", ctx)).toBeUndefined()
  expect(refusalOf("track", "b", "staff", ctx)).toBeDefined()
  expect(refusalOf("track", "c", "ceo", { ...ctx, isSubagent: true })).toBeDefined()
})
