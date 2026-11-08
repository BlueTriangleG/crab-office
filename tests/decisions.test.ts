import { expect, test } from "claude-code/testing"

import { answerOf, hereOf, isAway, pendingOf, rowsOf, settleRefusal } from "../hooks/decisions.ts"
import type { Decision } from "../hooks/decisions.ts"
import { companyOf, createSnapshot, orderPromptOf, promptOf, whoOf } from "../hooks/office.ts"
import { setLanguage, w } from "../hooks/words.ts"

setLanguage("zh")

const T0 = 1_000_000
const asked = (id: string, by: string, at: number, text: string): Decision => ({ id, by, at, text })

test("the chairman's list holds what is still waiting, oldest first", async () => {
  const items = [asked("d2", "b", T0 + 2, "方案 D 上不上"), asked("d1", "a", T0 + 1, "PR #542 谁来审"), asked("d3", "b", T0 + 3, "重启 approver")]
  const settled = [{ id: "d3", by: "x", at: T0 + 9, text: "重启" }]
  expect(pendingOf(items, settled).map((d) => d.id)).toEqual(["d1", "d2"])
})

test("an item is settled by the session that asked or by the CEO, no one else", async () => {
  const d = asked("d1", "b", T0, "方案 D 上不上")
  expect(settleRefusal(d, "b", false)).toBeUndefined()
  expect(settleRefusal(d, "a", true)).toBeUndefined()
  expect(settleRefusal(d, "c", false)).toBeDefined()
  expect(settleRefusal(undefined, "b", false)).toBeDefined()
})

test("each row names who is waiting by its job title, else its place; one that left still shows", async () => {
  const a = createSnapshot("a", "web-app", undefined, T0)
  const b = createSnapshot("b", "web-app", undefined, T0, "docs")
  const rows = rowsOf([asked("d1", "a", T0, "x"), asked("d2", "b", T0, "y"), asked("d3", "gone", T0, "z")], [a, b], { a: "voice" })
  expect(rows.map((r) => r.who)).toEqual(["voice", whoOf(b), "gone"])
  expect(rows.map((r) => r.id)).toEqual(["d1", "d2", "d3"])
})

test("the chairman's answer goes to the session that asked as the chairman's own words, naming what it answers", async () => {
  const text = orderPromptOf(answerOf(asked("d1", "b", T0, "方案 D 上不上"), "上，但先在 dev 跑一天"))
  expect(text).toContain("#d1")
  expect(text).toContain("方案 D 上不上")
  expect(text).toContain("上，但先在 dev 跑一天")
  // on the asker's card it reads as the answer, not as the office's wrapping
  expect(promptOf(`The crab-office plugin sent a message: ${text}`)).not.toContain("[")
})

test("the crab of a session with something on the chairman's list asks: a ? on its seat, and only its", async () => {
  const a = createSnapshot("a", "web-app", undefined, T0)
  const b = createSnapshot("b", "api-server", undefined, T0)
  for (const s of [a, b]) s.updatedAt = T0 + 10
  const company = companyOf([a, b], "a", T0 + 10, { memos: [], claims: [], asking: ["b"] })
  const seats = company.rooms.flatMap((r) => r.teams.flat())
  expect(seats.filter((s) => s.asking === true).map((s) => s.id)).toEqual(["b"])
})

test("an answer to a session that is not at work waits for it, and the receipt must say so", async () => {
  const b = createSnapshot("b", "web-app", undefined, T0)
  b.updatedAt = T0
  expect(isAway(b, T0 + 5_000)).toBe(false)
  // gone quiet, closed, or not in the company at all
  expect(isAway(b, T0 + 60_000)).toBe(true)
  expect(isAway({ ...b, ended: true }, T0 + 5_000)).toBe(true)
  expect(isAway(undefined, T0)).toBe(true)
})

test("an item the chairman must confirm in the session itself says so on the list, and is that session's alone to clear", async () => {
  const a = createSnapshot("a", "web-app", undefined, T0)
  const here: Decision = { ...asked("d1", "a", T0, "gh pr ready #12"), here: true }
  const rows = rowsOf([here, asked("d2", "a", T0, "方案 D 上不上")], [a], { a: "feedback" })
  expect(rows.map((r) => r.text)).toEqual([w().inPerson("gh pr ready #12"), "方案 D 上不上"])
  expect(rows[0]?.text).toContain("gh pr ready #12")
  expect(hereOf([here, asked("d2", "a", T0, "y"), { ...here, id: "d3", by: "b" }], "a").map((d) => d.id)).toEqual(["d1"])
})
