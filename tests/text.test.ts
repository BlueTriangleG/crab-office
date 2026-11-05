import { expect, test } from "claude-code/testing"

import { companyOf, createSnapshot, messageSent, turnStarted } from "../hooks/office.ts"
import { cardText, officeText } from "../hooks/text.ts"
import { setLanguage, w } from "../hooks/words.ts"

setLanguage("zh")

const T0 = 1_000_000

test("the office as text: each room, each session by its title with its marks, what waits on the chairman, the board", async () => {
  const a = createSnapshot("a", "web-app", undefined, T0)
  const b = createSnapshot("b", "api-server", undefined, T0)
  for (const s of [a, b]) s.updatedAt = T0 + 10
  turnStarted(b, undefined, "Agree the checkout fields", T0 + 5)
  messageSent(a, undefined, w().chairman, "to decide: ship v2?", T0 + 6)
  const company = companyOf([a, b], "a", T0 + 10, { memos: [], claims: [], titles: { b: "api" }, asking: ["b"] })
  const text = officeText(company, [{ id: "d1", who: "api", text: "ship v2?" }])
  expect(text).toContain(w().dept("web-app"))
  expect(text).toContain(w().dept("api-server"))
  // the session asking the chairman, by its title, marked
  expect(text).toMatch(/\? api .*Agree the checkout fields/)
  expect(text).toContain("#d1")
  expect(text).toContain("ship v2?")
  expect(text).toContain("to decide: ship v2?")
})

test("a card as text: its rows, its talk, each instruction delivered or still waiting, and each btw with its answer", async () => {
  const text = cardText(
    { title: "组长", where: "web-app 部 · docs", state: "思考中 · 2 分钟", color: "#fff", rows: [{ label: "任务", text: "补文档" }] },
    [{ role: "user", text: "先补 API 文档" }, { role: "assistant", text: "好的" }],
    [{ text: "再跑一遍测试", isDelivered: true }, { text: "改 README", isDelivered: false }],
    [{ question: "进度怎样？", answer: "写了一半" }, { question: "卡在哪？" }],
  )
  for (const part of ["组长", "web-app 部 · docs", "任务", "补文档", "先补 API 文档", "好的", "写了一半", "卡在哪？"])
    expect(text).toContain(part)
  expect(text).toContain(`再跑一遍测试  ${w().orderDelivered}`)
  expect(text).toContain(`改 README  ${w().orderQueued}`)
})
