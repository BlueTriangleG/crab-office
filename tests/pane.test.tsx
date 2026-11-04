import { expect, test } from "claude-code/testing"

const PANE = {
  plugin: "crab-office",
  component: "Pane",
  requestId: "crab-office",
  props: {
    title: "Crab office",
    isFocused: false,
    bodyColumns: 44,
    placement: "dock",
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test("the field to write on the board says in one line whom it can call, with no list of names", async ($, on) => {
  on("session.start", (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: "/work/web-app", surface: "terminal", isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" })
  expect(await ui.find({ type: "Text", text: /^\s*@everyone\s*$/ })).toBeUndefined()
  expect((await ui.find({ type: "Text", text: /no @/ }))?.text).toBe("@team, @department or @everyone; no @ goes to whoever is free first")
  await ui.unmount()
})
