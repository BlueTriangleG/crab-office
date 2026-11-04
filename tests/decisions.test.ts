import { expect, test } from "claude-code/testing"

import { pendingOf, rowsOf, settleRefusal } from "../hooks/decisions.ts"
import type { Decision } from "../hooks/decisions.ts"
import { createSnapshot, whoOf } from "../hooks/office.ts"
import { setLanguage } from "../hooks/words.ts"

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
