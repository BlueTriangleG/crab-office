import { expect, test } from "claude-code/testing"

import { companyOf, createSnapshot, messageSent, promptOf, targetOf } from "../hooks/office.ts"
import { BUILT_IN, chairmanFor, nameFrom, needsName, parseThemeArgs, themeNamed, themeNote, themeOff } from "../hooks/themes.ts"
import { setLanguage, setTheme, w } from "../hooks/words.ts"

setLanguage("zh")

const T0 = 1_000_000

test("a theme is chosen by name, with how to address the chairman after it", async () => {
  expect(parseThemeArgs("字节 高总")).toEqual({ name: "字节", chairman: "高总" })
  expect(parseThemeArgs("  default ")).toEqual({ name: "default" })
  expect(parseThemeArgs("")).toBeUndefined()
})

test("a theme is a built-in one or a file of the person's own, which wins by name", async () => {
  expect(themeNamed("字节", [])?.voice).toBe(BUILT_IN.find((t) => t.name === "字节")?.voice)
  const mine = { name: "字节", chairman: "老大", voice: "更随意" }
  expect(themeNamed("字节", [mine])).toEqual(mine)
  expect(themeNamed("nope", [mine])).toBeUndefined()
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
  const note = themeNote({ name: "字节", voice: "互相叫同学", examples: ["{chairman}，同步一下进展："] }, "高总")
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

test("the built-in 字节 theme speaks Chinese, calls colleagues 同学 and renames meetings and the board", async () => {
  const t = BUILT_IN.find((x) => x.name === "字节")
  expect(t?.language).toBe("zh")
  expect(t?.titles?.lead).toBe("同学")
  expect(t?.terms?.["会议"]).toBe("组会")
  expect(t?.voice).toContain("同学")
})

test("字节 calls the chairman X总, and until the chairman has said what X is, 老板", async () => {
  const byte = BUILT_IN.find((x) => x.name === "字节")!
  expect(byte.chairman).toBe("{name}总")
  expect(byte.nameQuestion).toContain("总")
  const chosen = { name: "字节", at: T0 }
  expect(needsName(byte, chosen)).toBe(true)
  expect(chairmanFor(byte, chosen)).toBe("老板")
  // named, by the answer or by the command
  expect(chairmanFor(byte, { ...chosen, chairman: "高总" })).toBe("高总")
  expect(needsName(byte, { ...chosen, chairman: "高总" })).toBe(false)
  // a theme with a plain name asks nothing
  const plain = { name: "x", chairman: "老大" }
  expect(needsName(plain, chosen)).toBe(false)
  expect(chairmanFor(plain, chosen)).toBe("老大")
})

test("the answer to what X is, however it is put, is the name alone", async () => {
  for (const said of ["高", "高总", " 叫我高总 ", "我是高总。"]) expect(nameFrom(said)).toBe("高")
})

test("the theme's own note names the chairman plainly, even with the chairman's name among the terms", async () => {
  setTheme({ chairman: "高总", terms: { 董事长: "高总" } })
  const note = themeNote({ name: "字节", voice: "v" }, "高总")
  expect(note).toContain("称呼董事长（用户）为「高总」")
  setTheme(undefined)
})
