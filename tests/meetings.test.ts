import { expect, test } from "claude-code/testing"

import { LEAVE_MS, companyOf, createSnapshot, promptOf } from "../hooks/office.ts"
import { MEETING, closeRefusal, meetingNameRefusal, meetingNamed, meetingsOf, speakRefusal } from "../hooks/meetings.ts"
import type { MeetingFile } from "../hooks/meetings.ts"
import { setLanguage, w } from "../hooks/words.ts"

setLanguage("zh")

const T0 = 1_000_000

const office = (now = T0 + 100) => {
  const a = createSnapshot("a", "web-app", undefined, T0)
  const b = createSnapshot("b", "api-server", undefined, T0)
  const c = createSnapshot("c", "mobile", undefined, T0)
  const snaps = [a, b, c]
  for (const s of snaps) s.updatedAt = now
  const opened: MeetingFile = {
    id: "m1",
    writer: "a",
    members: ["a", "b"],
    said: 1,
    lastAt: T0 + 10,
    open: { name: "api-contract", topic: "定接口字段", at: T0 },
  }
  return { a, b, c, snaps, opened }
}

test("a meeting is what its files say together: everyone anyone brought, every word counted", async () => {
  const { snaps, opened } = office()
  const added: MeetingFile = { id: "m1", writer: "b", members: ["c"], said: 2, lastAt: T0 + 50 }
  const [m] = meetingsOf([added, opened], snaps, T0 + 100)
  expect(m).toMatchObject({
    id: "m1",
    name: "api-contract",
    topic: "定接口字段",
    by: "a",
    members: ["a", "b", "c"],
    said: 3,
    lastAt: T0 + 50,
    status: "open",
  })
  // its opening not read yet, it is no meeting
  expect(meetingsOf([added], snaps, T0 + 100)).toEqual([])
})

test("a meeting ends when closed, quiet too long, or down to one; full, it waits for its conclusion", async () => {
  const status = (files: MeetingFile[], now: number) => meetingsOf(files, office(now).snaps, now)[0]?.status
  expect(status([{ ...opened(), close: { at: T0 + 20, conclusion: "用 v2" } }], T0 + 100)).toBe("closed")
  expect(status([opened()], T0 + 10 + MEETING.idleMs - 1)).toBe("open")
  expect(status([opened()], T0 + 10 + MEETING.idleMs + 1)).toBe("idle")
  expect(status([{ ...opened(), said: MEETING.saidMax }], T0 + 100)).toBe("full")
  // one member left the company: one is no meeting
  const { snaps } = office()
  const b = snaps[1]
  if (b !== undefined) b.updatedAt = T0 + 100 - LEAVE_MS - 1
  expect(meetingsOf([opened()], snaps, T0 + 100)[0]?.status).toBe("empty")
})

const opened = () => office().opened

test("a meeting's name is one word, not CEO, nobody's name or title, and no live meeting's", async () => {
  const { snaps } = office()
  const meetings = meetingsOf([opened()], snaps, T0 + 100)
  const peers = [{ sessionId: "b", name: "api-server-e0" }]
  const titles = { c: "mobile" }
  const refused = (name: string, held = meetings) => meetingNameRefusal(name, held, titles, snaps, peers, T0 + 100)
  expect(refused("schema")).toBeUndefined()
  for (const bad of ["two words", "", "x".repeat(25), "CEO", "api-server-e0", "Mobile", "API-contract"])
    expect(refused(bad)).toBeDefined()
  // a closed meeting's name is free again
  const closed = meetingsOf([{ ...opened(), close: { at: T0 + 20, conclusion: "" } }], snaps, T0 + 100)
  expect(refused("api-contract", closed)).toBeUndefined()
})

test("only a member speaks to a live meeting; only whoever called it closes it", async () => {
  const { snaps } = office()
  const of = (file: MeetingFile) => meetingsOf([file], snaps, T0 + 100)[0]!
  const live = of(opened())
  const ended = of({ ...opened(), id: "m0", close: { at: T0 + 20, conclusion: "" } })
  // by name, any case; a live meeting before an ended one of the same name
  expect(meetingNamed("API-Contract", [ended, live])?.id).toBe("m1")
  expect(meetingNamed("api-contract", [ended])?.id).toBe("m0")
  expect(meetingNamed("other", [live])).toBeUndefined()
  expect(speakRefusal(live, "a")).toBeUndefined()
  expect(speakRefusal(live, "c")).toContain("api-contract")
  expect(closeRefusal(live, "a")).toBeUndefined()
  expect(closeRefusal(live, "b")).toBeDefined()
  const full = of({ ...opened(), said: MEETING.saidMax })
  expect(speakRefusal(full, "b")).toContain("close")
  expect(closeRefusal(full, "a")).toBeUndefined()
  expect(speakRefusal(ended, "a")).toBeDefined()
  expect(closeRefusal(ended, "a")).toBeDefined()
})

test("a meeting has a room of its own at the top, its members out of their departments", async () => {
  const { snaps } = office()
  const meetings = meetingsOf([opened()], snaps, T0 + 100)
  const company = companyOf(snaps, "a", T0 + 100, { memos: [], claims: [], meetings })
  const [room, ...rest] = company.rooms
  expect(room?.title).toContain("api-contract")
  expect(room?.top).toBe(true)
  expect(room?.teams.length).toBe(2)
  expect(room?.signs).toEqual(["web-app", "api-server"])
  expect(room?.here).toBe(0)
  expect(rest.map((r) => r.title)).toEqual([w().dept("mobile")])
  // closed, everyone is back at their desk
  const closed = meetingsOf([{ ...opened(), close: { at: T0 + 20, conclusion: "" } }], snaps, T0 + 100)
  expect(companyOf(snaps, "a", T0 + 100, { memos: [], claims: [], meetings: closed }).rooms.length).toBe(3)
})

test("a meeting's own prompts read as short tasks on a card, in either language", async () => {
  for (const lang of ["zh", "en"]) {
    setLanguage(lang)
    const sent = (text: string) => promptOf(`The crab-office plugin sent a message: ${text}`)
    expect([
      sent(w().meetingInvite("api-contract", "定接口字段", "web-app", ["api-server"])),
      sent(w().meetingEnvelope("api-contract", "web-app", "我建议用 v2", undefined)),
      sent(w().meetingClosedEnvelope("api-contract", "用 v2")),
    ]).toEqual([w().meetingTask("api-contract"), w().meetingTask("api-contract"), w().meetingTask("api-contract")])
  }
  setLanguage("zh")
})
