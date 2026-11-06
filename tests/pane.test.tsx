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

test("the pane ends with what is waiting on the chairman, saying so when nothing is", async ($, on) => {
  on("session.start", (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: "/work/web-app", surface: "terminal", isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" })
  expect((await ui.find({ type: "Text", text: /Waiting on you/ }))?.text).toBe("Waiting on you: nothing")
  await ui.unmount()
})

test("opening the pane again mounts its drawings afresh, so one unmounted for an overrun comes back", async ($, on) => {
  on("session.start", (_, e) => ({ cwd: e.cwd }))
  on("ui.open", () => ({ value: { isPlaced: true } }))
  await $.session.start({ cwd: "/work/web-app", surface: "terminal", isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" })
  const keys = async () => (await ui.findAll({ type: "Client" })).map((c) => c.key)
  const before = await keys()
  expect(before.length).toBeGreaterThan(0)
  await $.command.run({ command: "office", args: "", origin: { kind: "composer" }, presentation: { isFullscreen: false, columns: 120 } })
  const after = await keys()
  expect(after).toHaveLength(before.length)
  expect(after.filter((k) => before.includes(k))).toEqual([])
  await ui.unmount()
})
