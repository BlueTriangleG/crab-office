import { expect, test } from "claude-code/testing"

import { herdrPlaceOf, tabLabelOf, withWorktree } from "../hooks/herdr.ts"
import { setLanguage, setTheme } from "../hooks/words.ts"

test("a session is in herdr only with HERDR_ENV=1 and a tab of its own; outside it nothing runs", async () => {
  expect(herdrPlaceOf({})).toBeUndefined()
  expect(herdrPlaceOf({ HERDR_ENV: "0", HERDR_TAB_ID: "w1:t1" })).toBeUndefined()
  expect(herdrPlaceOf({ HERDR_ENV: "1" })).toBeUndefined()
  expect(herdrPlaceOf({ HERDR_ENV: "1", HERDR_TAB_ID: "w1:t1" })).toEqual({ tab: "w1:t1" })
})

test("a tab carries the session's job title, marked while it waits on the chairman in person", async () => {
  setLanguage("zh")
  expect(tabLabelOf("voice", false, "2")).toBe("voice")
  expect(tabLabelOf(undefined, false, "crab office")).toBe("crab office")
  expect(tabLabelOf("voice", true, "2")).toBe("⏳ voice · 等你确认")
  expect(tabLabelOf(undefined, true, "crab office")).toBe("⏳ crab office · 等你确认")
  setTheme({ chairman: "高总", terms: { 等你: "等高总" } })
  expect(tabLabelOf("voice", true, "2")).toBe("⏳ voice · 等高总确认")
  setTheme(undefined)
  setLanguage("en")
  expect(tabLabelOf("voice", true, "2")).toBe("⏳ voice · needs you")
})

test("a job given to a session in herdr says to do it in a worktree of its own; one outside herdr is told nothing of it", async () => {
  setLanguage("zh")
  expect(withWorktree("派活", false)).toBe("派活")
  const told = withWorktree("派活", true)
  expect(told.startsWith("派活\n\n")).toBe(true)
  // From a pane in a worktree workspace, herdr refuses a create without the
  // repository's main workspace, wherever the shell has cd'd to.
  for (const part of ["herdr worktree create --workspace <主工作区 id> --branch", "is_linked_worktree", "--no-focus", "herdr worktree remove --workspace", "正在做的活不用搬"]) expect(told).toContain(part)
})
