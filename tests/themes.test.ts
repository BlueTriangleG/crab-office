import { expect, test } from "claude-code/testing"

import { companyOf, createSnapshot, messageSent, targetOf } from "../hooks/office.ts"
import { BUILT_IN, parseThemeArgs, themeNamed, themeNote, themeOff } from "../hooks/themes.ts"
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
