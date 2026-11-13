import { expect, test } from "claude-code/testing"

import { companyOf, createSnapshot } from "../hooks/office.ts"
import { officeText } from "../hooks/text.ts"
import { UPDATES_SHOWN, updateRowsOf } from "../hooks/updates.ts"
import { setLanguage, w } from "../hooks/words.ts"

setLanguage("zh")

const T0 = 1_000_000

// The CEO's word to the chairman scrolled away in its own conversation, under
// every nudge and colleague's message that came after it.
test("what was said to the chairman stays under the office: the newest whole, a line each before it, by who said it", async () => {
  const ceo = createSnapshot("a", "web-app", undefined, T0)
  const said = Array.from({ length: UPDATES_SHOWN + 2 }, (_, i) => ({ id: `u${i}`, at: T0 + i * 60_000, by: "a", text: `update ${i}\n- second line` }))
  const rows = updateRowsOf(said, [ceo], { a: "CEO" })
  expect(rows).toHaveLength(UPDATES_SHOWN)
  expect(rows[0]).toMatchObject({ who: "CEO", text: `update ${UPDATES_SHOWN + 1}\n- second line` })
  expect(rows[1]?.text).toBe(`update ${UPDATES_SHOWN} - second line`)
  expect(rows.map((r) => r.text).join()).not.toContain("update 0")
  // one from a session no longer here still shows, with nobody's id for a name
  expect(updateRowsOf([{ id: "u", at: T0, by: "gone", text: "x" }], [], {})[0]?.who).toBeUndefined()
  const text = officeText(companyOf([], "a", T0, { memos: [], claims: [] }), [], [], rows)
  expect(text).toContain(w().updatesHead)
  expect(text).toContain(`update ${UPDATES_SHOWN + 1}`)
})
