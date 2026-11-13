import { expect, test } from "claude-code/testing"

import { companyOf, createSnapshot } from "../hooks/office.ts"
import { officeText } from "../hooks/text.ts"
import { updateRowOf } from "../hooks/updates.ts"
import { setLanguage, w } from "../hooks/words.ts"

setLanguage("zh")

const T0 = 1_000_000

// Each report is the whole picture, so the one kept is shown as it was written.
test("the CEO's latest report shows whole, by who wrote it", async () => {
  const ceo = createSnapshot("a", "web-app", undefined, T0)
  const row = updateRowOf({ id: "u", at: T0, by: "a", text: "done: the login fix\n- next: the reminders" }, [ceo], { a: "CEO" }, T0)
  expect(row).toMatchObject({ who: "CEO", text: "done: the login fix\n- next: the reminders" })
  expect(updateRowOf(undefined, [ceo], {}, T0)).toBeUndefined()
  // one from a session no longer here still shows, with nobody's id for a name
  expect(updateRowOf({ id: "u", at: T0, by: "gone", text: "x" }, [], {}, T0)?.who).toBeUndefined()
  // it stays until the next report, so one from another day says which
  expect(row?.when).toMatch(/^\d\d:\d\d$/)
  expect(updateRowOf({ id: "u", at: T0, by: "a", text: "x" }, [], {}, T0 + 3 * 86_400_000)?.when).toMatch(/^\d+-\d+ \d\d:\d\d$/)
  const text = officeText(companyOf([], "a", T0, { memos: [], claims: [] }), [], [], row)
  expect(text).toContain(w().updatesHead)
  expect(text).toContain("done: the login fix")
})
