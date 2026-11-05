import { expect, test } from "claude-code/testing"

import { companyOf, createSnapshot, messageSent, promptOf, targetOf } from "../hooks/office.ts"
import { chairmanFor, nameFrom, namesFor, needsName, parseTheme, parseThemeArgs, themeNamed, themeNote, themeOff } from "../hooks/themes.ts"
import { partOf } from "../hooks/pixels.ts"
import { setLanguage, setTheme, w } from "../hooks/words.ts"

setLanguage("zh")

const T0 = 1_000_000

test("a theme is chosen by name, with how to address the chairman after it", async () => {
  expect(parseThemeArgs("字节 高总")).toEqual({ name: "字节", chairman: "高总" })
  expect(parseThemeArgs("  default ")).toEqual({ name: "default" })
  expect(parseThemeArgs("")).toBeUndefined()
})

test("a theme is found by its folder or its name; the person's own, listed first, wins", async () => {
  const shipped = { id: "bytedance", name: "字节", voice: "shipped" }
  const mine = { id: "my-byte", name: "字节", voice: "mine" }
  expect(themeNamed("bytedance", [shipped])?.voice).toBe("shipped")
  expect(themeNamed("字节", [mine, shipped])?.voice).toBe("mine")
  expect(themeNamed("ByteDance", [shipped])?.id).toBe("bytedance")
  expect(themeNamed("nope", [mine, shipped])).toBeUndefined()
})

test("a theme folder's theme.json is read for what it may hold, and a broken one is no theme", async () => {
  const text = JSON.stringify({
    name: "字节",
    language: "zh",
    chairman: "{name}总",
    chairmanUnnamed: "老板",
    nameQuestion: "怎么称呼您？",
    titles: { lead: "同学", chief: 3 },
    terms: { 会议: "组会" },
    voice: "v",
    examples: ["a", 2, "b"],
    crabs: { later: true },
  })
  expect(parseTheme(text, "bytedance")).toEqual({
    id: "bytedance",
    name: "字节",
    language: "zh",
    chairman: "{name}总",
    chairmanUnnamed: "老板",
    nameQuestion: "怎么称呼您？",
    titles: { lead: "同学" },
    terms: { 会议: "组会" },
    voice: "v",
    examples: ["a", "b"],
  })
  // no name: the folder's
  expect(parseTheme("{}", "plain")).toEqual({ id: "plain", name: "plain" })
  expect(parseTheme("{not json", "x")).toBeUndefined()
  expect(parseTheme('{"language":"fr"}', "x")).toEqual({ id: "x", name: "x" })
})

test("a theme renames the chairman and the ranks everywhere the office names them, until it is switched back", async () => {
  setTheme({ chairman: "高总", titles: { lead: "同学" } })
  expect(w().chairman).toBe("高总")
  expect(w().titles.lead).toBe("同学")
  expect(w().titles.chief).toBe("部长")
  // a line written to the chairman shows the name the chairman goes by now
  const a = createSnapshot("a", "web-app", undefined, T0)
  a.updatedAt = T0
  messageSent(a, undefined, "董事长", "请拍板：上不上", T0)
  expect(companyOf([a], "a", T0, { memos: [], claims: [] }).board?.at(-1)?.to.name).toBe("高总")
  // and a post to 高总 is to the chairman, not to a team called 高总
  expect(targetOf("高总")).toBeUndefined()
  setTheme(undefined)
  expect(w().chairman).toBe("董事长")
  expect(w().titles.lead).toBe("组长")
})

test("the note a session is given names the chairman, the voice, its examples, and what the theme never touches", async () => {
  const note = themeNote({ id: "bytedance", name: "字节", voice: "互相叫同学", examples: ["{chairman}，同步一下进展："] }, "高总")
  for (const part of ["字节", "高总", "互相叫同学", "高总，同步一下进展：", "代码", "PR"]) expect(note).toContain(part)
  expect(note).not.toContain("{chairman}")
  expect(themeOff()).toContain("默认")
})

test("a theme's terms rename the office's own words, but never the envelopes the office reads back", async () => {
  setTheme({ terms: { 会议: "组会", 会议室: "会议室", 共享白板: "大群", 董事长: "高总" } })
  expect(w().board).toBe("大群")
  expect(w().meetingTask("api")).toBe("组会 api")
  // the longer term stands: a 会议室 is not a 组会室
  expect(w().meetingRoom("api", "字段")).toBe("会议室 · api：字段")
  // words with nothing to rename are as they were
  expect(w().titles.chief).toBe("部长")
  // a meeting's envelope keeps its words, so its card still reads as a short task
  const invite = w().meetingInvite("api", "字段", "web-app", ["api-server"])
  expect(invite).toContain("会议 api")
  expect(promptOf(`The crab-office plugin sent a message: ${invite}`)).toBe(w().meetingTask("api"))
  setTheme(undefined)
  expect(w().board).toBe("共享白板")
})


test("字节 calls the chairman X总, and until the chairman has said what X is, 老板", async () => {
  const byte = { id: "bytedance", name: "字节", chairman: "{name}总", chairmanUnnamed: "老板", nameQuestion: "怎么称呼您？" }
  const chosen = { name: "字节", at: T0 }
  expect(needsName(byte, chosen)).toBe(true)
  expect(chairmanFor(byte, chosen)).toBe("老板")
  // named, by the answer or by the command
  expect(chairmanFor(byte, { ...chosen, chairman: "高总" })).toBe("高总")
  expect(needsName(byte, { ...chosen, chairman: "高总" })).toBe(false)
  // a theme with a plain name asks nothing
  const plain = { id: "x", name: "x", chairman: "老大" }
  expect(needsName(plain, chosen)).toBe(false)
  expect(chairmanFor(plain, chosen)).toBe("老大")
})

test("the answer to what X is, however it is put, is the name alone", async () => {
  for (const said of ["高", "高总", " 叫我高总 ", "我是高总。"]) expect(nameFrom(said)).toBe("高")
})

test("the theme's own note names the chairman plainly, even with the chairman's name among the terms", async () => {
  setTheme({ chairman: "高总", terms: { 董事长: "高总" } })
  const note = themeNote({ id: "bytedance", name: "字节", voice: "v" }, "高总")
  expect(note).toContain("称呼董事长（用户）为「高总」")
  setTheme(undefined)
})

test("waiting on the chairman reads as waiting on the chairman's name; waiting on a session stays 等你", async () => {
  setTheme(namesFor({ id: "bytedance", name: "字节", terms: { 共享白板: "大群" } }, "高总"))
  expect(w().status.idle).toBe("等高总")
  expect(w().status.approval).toBe("等高总批准")
  expect(w().chairmanList(1)).toBe("等高总拍板（1）")
  expect(w().chairman).toBe("高总")
  // these speak to a session, whose 你 is itself
  expect(w().tool.notOpen).toContain("不等你")
  expect(w().ceoWaiting).toContain("等你验收")
  setTheme(undefined)
})

test("the drawing gets the theme with its language, since it is drawn apart from the hooks that chose it", async () => {
  setTheme({ terms: { 共享白板: "大群" } })
  const a = createSnapshot("a", "web-app", undefined, T0)
  a.updatedAt = T0
  const company = companyOf([a], "a", T0, { memos: [], claims: [] })
  const part = partOf(company, 80)
  expect(part.theme).toEqual({ terms: { 共享白板: "大群" } })
  setTheme(undefined)
  // with no theme, nothing is carried: an undefined prop would be refused
  expect("theme" in partOf(companyOf([a], "a", T0, { memos: [], claims: [] }), 80)).toBe(false)
})
