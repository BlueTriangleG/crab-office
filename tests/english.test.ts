import { expect, test } from "claude-code/testing"

import { companyOf, createSnapshot, handoverOf, parseSay, spawned, targetOf, turnFinished } from "../hooks/office.ts"
import { office } from "../hooks/pixels.ts"
import { setLanguage } from "../hooks/words.ts"

const T0 = 1_000_000

// The other tests read the office in Chinese; this one sets English for itself
// and puts Chinese back however it ends.
test("in English the office, its board and its memos speak English", async () => {
  setLanguage("en")
  try {
    const hq = createSnapshot("a", "web-app", undefined, T0)
    const wt = createSnapshot("b", "web-app", undefined, T0 + 1, "checkout")
    spawned(hq, { agentId: "x", type: "Explore", isFork: false, description: "map the code", prompt: "p" }, T0 + 2)
    turnFinished(wt, undefined, { isAnswer: true, answer: "ok" }, T0 + 3)
    for (const s of [hq, wt]) s.updatedAt = T0 + 5
    const company = companyOf([hq, wt], "b", T0 + 5)
    expect(company.lang).toBe("en")
    expect(company.header).toBe("Crab Co.  Chairman: you  3 on duty")
    const room = company.rooms[0]!
    expect(room.title).toBe("web-app")
    expect(room.signs).toEqual(["HQ", "checkout"])
    expect(room.footer).toBe("1 working  2 waiting")
    expect(company.board?.[0]?.from.name).toBe("Director")

    const text = office(company, 60, 0).cells.map((line) => line.map((c) => c.ch).join("")).join("\n")
    expect(text).toContain("Director")
    expect(text).toContain("Done!")
    expect(text).toContain("◀ you")
    expect(text).toContain("Whiteboard")

    expect(parseSay("@HQ look at CI", "m", T0)?.to).toEqual({ kind: "team", name: "本部" })
    expect(parseSay("@everyone stand up", "m", T0)?.to).toEqual({ kind: "all" })
    expect(targetOf("Chairman")).toBeUndefined()
    const memo = parseSay("@checkout fix the copy", "m1", T0)!
    const handover = handoverOf(memo, wt, [hq, wt], T0 + 5)
    expect(handover).toContain("[crab-office · the chairman's memo on the board · checkout · memo m1]")
    expect(handover).toContain("You are the Lead of web-app · checkout.")
    expect(handover).toContain("- web-app · HQ Director: waiting for you, 1 crew")
  } finally {
    setLanguage("zh")
  }
})
