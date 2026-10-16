import { expect, test } from "claude-code/testing"

import { SEAT_COLS, SEAT_ROWS, heightOf, lidOf, office, restingOf, runsOf, slicesOf } from "../hooks/pixels.ts"
import type { Company, SeatData } from "../hooks/pixels.ts"

const QUADRANTS = new Set([..." ▘▝▖▗▀▄▌▐▚▞▛▜▙▟█"])
const LOOKS = [
  "thinking",
  "editing",
  "reading",
  "searching",
  "running",
  "browsing",
  "delegating",
  "approval",
  "idle",
  "asleep",
  "done",
  "failed",
  "gone",
]

function seat(id: string, role: string, look: string): SeatData {
  return { id, role, task: "map packages", look, color: "#6a9bcc" }
}

function team(n: number): SeatData[] {
  return [
    seat("boss", "leader", "editing"),
    ...Array.from({ length: n }, (_, i) =>
      seat(`a${i}`, "Explore", "searching"),
    ),
  ]
}

function oneRoom(teams: SeatData[][]): Company {
  return {
    header: "螃蟹有限公司",
    rooms: [{ title: "web-app 部", footer: "1 在干活", teams }],
  }
}

test("every look draws at every tick as cells a terminal can show", async () => {
  const company = oneRoom([
    LOOKS.map((look, i) => seat(`s${i}`, i === 0 ? "leader" : "Plan", look)),
  ])
  for (const cols of [30, 44, 58]) {
    for (let t = 0; t < 24; t++) {
      const drawn = office(company, cols, t)
      expect(drawn.rows).toBe(heightOf(company, cols))
      for (const line of drawn.cells) {
        expect(line).toHaveLength(cols)
        for (const cell of line)
          if (!cell.isText) expect(QUADRANTS.has(cell.ch)).toBe(true)
      }
    }
  }
})

test("a team is an org chart: the manager centred above, the crew hung from one line", async () => {
  const drawn = office(oneRoom([team(3)]), 34, 0)
  const at = (id: string) => drawn.seats.find((s) => s.id === id)
  // 34 columns hold two desks a row inside the walls and their clear floor, the
  // pair centred: the manager centred over them, then a wire row, two crew,
  // another wire row, the third.
  expect(at("boss")).toEqual({ id: "boss", cx: 10, cy: 2 })
  expect(at("a0")).toEqual({ id: "a0", cx: 3, cy: 2 + SEAT_ROWS + 1 })
  expect(at("a1")).toEqual({
    id: "a1",
    cx: 3 + SEAT_COLS,
    cy: 2 + SEAT_ROWS + 1,
  })
  expect(at("a2")).toEqual({ id: "a2", cx: 10, cy: 2 + 2 * (SEAT_ROWS + 1) })
  const wire = drawn.cells[2 + SEAT_ROWS]!.map((c) => c.ch).join("")
  expect(wire.slice(10, 25)).toBe("┌──────┴──────┐")
})

test("the band keeps a whole team on one row with no walls", async () => {
  const band: Company = {
    rooms: [
      { title: "", footer: "", bare: true, flat: true, teams: [team(4)] },
    ],
  }
  expect(heightOf(band, 0)).toBe(SEAT_ROWS)
  const drawn = office(band, 80, 0)
  expect(drawn.seats.map((s) => s.cy)).toEqual([0, 0, 0, 0, 0])
  expect(drawn.cells.flat().some((c) => c.ch === "│")).toBe(false)
})

test("a selected crab's name plate is drawn in its own colour", async () => {
  const drawn = office(oneRoom([team(1)]), 34, 0, "a0")
  const a0 = drawn.seats.find((s) => s.id === "a0")!
  const plate = drawn.cells[a0.cy + SEAT_ROWS - 1]!.slice(
    a0.cx,
    a0.cx + SEAT_COLS - 1,
  )
  expect(plate.every((c) => c.bg === "#6a9bcc")).toBe(true)
})

test("the shared board sits under the rooms, two rows a line", async () => {
  const lines = [
    { time: "12:03", kind: "assign", from: { name: "经理", color: "#d77757" }, to: { name: "调研员", color: "#6a9bcc" }, text: "找调用点" },
    { time: "12:04", kind: "report", from: { name: "调研员", color: "#6a9bcc" }, to: { name: "经理", color: "#d77757" }, text: "找到 3 处" },
  ]
  const company: Company = { ...oneRoom([team(1)]), board: lines }
  const without = heightOf(oneRoom([team(1)]), 34)
  expect(heightOf(company, 34)).toBe(without + 2 + 4)
  const drawn = office(company, 34, 0)
  const text = (r: number) => drawn.cells[r]!.map((c) => c.ch).join("")
  expect(text(without)).toContain("共享白板")
  expect(text(without + 1)).toContain("12:03 经理 → 调研员")
  expect(text(without + 2)).toContain("找调用点")
})

test("an envelope walks the wire while work is handed down", async () => {
  const crew = { ...seat("a0", "Explore", "thinking"), mail: "down" as const }
  const company = oneRoom([[seat("boss", "leader", "delegating"), crew]])
  const wireRow = 2 + SEAT_ROWS
  const walk = [0, 1, 2, 3].map((t) => office(company, 34, t).cells[wireRow]!.findIndex((c) => c.ch === "✉"))
  // The single crew desk sits right under the manager's, so the envelope stays
  // on the junction; with no mail the wire is bare.
  expect(walk.every((x) => x === 10 + 7)).toBe(true)
  expect(office(oneRoom([team(1)]), 34, 0).cells[wireRow]!.some((c) => c.ch === "✉")).toBe(false)
})

test("with crew either side, the envelope travels from the manager's junction to its desk", async () => {
  const left = { ...seat("a0", "Explore", "thinking"), mail: "down" as const }
  const company = oneRoom([[seat("boss", "leader", "delegating"), left, seat("a1", "Plan", "reading")]])
  const wireRow = 2 + SEAT_ROWS
  const at = (t: number) => office(company, 34, t).cells[wireRow]!.findIndex((c) => c.ch === "✉")
  // The manager's junction is column 17, a0's is column 10.
  expect([0, 1, 3, 7, 8, 9].map(at)).toEqual([17, 16, 14, 10, 10, 10])
})

test("eyes stay open and still while waiting, and a glance moves them along one row", async () => {
  const eyesOf = (look: string, t: number) => {
    const band: Company = { rooms: [{ title: "", footer: "", bare: true, flat: true, teams: [[seat("boss", "leader", look)]] }] }
    const spots: string[] = []
    office(band, 14, t).cells.forEach((line, r) =>
      line.forEach((c, x) => {
        if (!c.isText && (c.fg === "#000000" || c.bg === "#000000")) spots.push(`${r}:${x}`)
      }),
    )
    return spots
  }
  const idle = Array.from({ length: 36 }, (_, t) => eyesOf("idle", t).join())
  expect(new Set(idle).size).toBe(1)
  expect(idle[0]).not.toBe("")
  const thinking = Array.from({ length: 24 }, (_, t) => eyesOf("thinking", t)).flat()
  expect(new Set(thinking.map((s) => s.split(":")[0])).size).toBe(1)
})

test("a crab asleep shuts its eyes with lids where they open", async () => {
  const band = (look: string): Company => ({ rooms: [{ title: "", footer: "", bare: true, flat: true, teams: [[seat("boss", "Plan", look)]] }] })
  // Asleep, the crab rests faded, and its lids are a shade of the faded body.
  const lid = lidOf(restingOf("#6a9bcc"))
  const lids = office(band("asleep"), 14, 0).cells.flat().filter((c) => c.fg === lid || c.bg === lid)
  expect(lids).toHaveLength(2)
})

test("a big team keeps two rows of desks and folds the rest into a crowd line", async () => {
  const company = oneRoom([team(9)])
  const drawn = office(company, 34, 0)
  // 34 columns hold two desks a row: four crew at desks, five in the crowd
  expect(drawn.seats.map((s) => s.id)).toEqual(["boss", "a0", "a1", "a2", "a3"])
  const crowdRow = 2 + SEAT_ROWS + 2 * (SEAT_ROWS + 1)
  const line = drawn.cells[crowdRow]!.map((c) => c.ch).join("")
  expect(line).toContain("还有 5 人")
  expect(drawn.cells[crowdRow]!.filter((c) => c.ch === "▄")).toHaveLength(5)
  expect(drawn.rows).toBe(heightOf(company, 34))
})

test("a board line names the crab who said it, and marks it while that crab is selected", async () => {
  const said = { time: "12:03", kind: "report", from: { name: "调研员", color: "#6a9bcc", id: "a0" }, to: { name: "经理", color: "#d77757", id: "boss" }, text: "找到了" }
  const company: Company = { ...oneRoom([team(1)]), board: [said] }
  const row = heightOf(oneRoom([team(1)]), 34) + 1
  expect(office(company, 34, 0).lines).toEqual([{ id: "a0", cy: row }])
  expect(office(company, 34, 0).cells[row]![1]!.ch).not.toBe("▸")
  expect(office(company, 34, 0, "a0").cells[row]![1]!.ch).toBe("▸")
})

test("a cheering manager waves and says so, and its room's walls flash green", async () => {
  const boss = { ...seat("boss", "leader", "idle"), finish: "cheer" as const }
  const company: Company = { header: "螃蟹有限公司", rooms: [{ title: "web-app 部", footer: "", isCheering: true, teams: [[boss]] }] }
  const text = (r: number, t: number) => office(company, 34, t).cells[r]!.map((c) => c.ch).join("")
  expect(text(1, 0)).toContain("web-app 部 ✓ 完成")
  expect(text(2 + 5, 0)).toContain("完成了！")
  const walls = [0, 2].map((t) => office(company, 34, t).cells[3]![0]!.fg)
  expect(walls[0]).not.toBe(walls[1])
})

test("each team of a department sits on its own rug under its sign", async () => {
  const company: Company = {
    rooms: [{ title: "web-app 部", footer: "", signs: ["本部", "checkout-redesign 组"], teams: [team(0), [seat("w", "lead", "idle")]] }],
  }
  const plain = { rooms: [{ title: "web-app 部", footer: "", teams: [team(0), [seat("w", "lead", "idle")]] }] }
  // side by side at this width, so the signs take one row between them
  expect(heightOf(company, 40)).toBe(heightOf(plain, 40) + 1)
  const drawn = office(company, 40, 0)
  const rows = drawn.cells.map((line) => line.map((c) => c.ch).join(""))
  expect(rows.some((r) => r.includes("▍本部"))).toBe(true)
  expect(rows.some((r) => r.includes("▍checkout-r"))).toBe(true)
  const wSeat = drawn.seats.find((s) => s.id === "w")!
  expect(drawn.cells[wSeat.cy + 5]!.map((c) => c.ch).join("")).toContain("组长")
})

test("a crab at work wears the spinner in full colour; a crab at rest fades", async () => {
  const one = (look: string): Company => ({ rooms: [{ title: "", footer: "", bare: true, flat: true, teams: [[seat("boss", "Explore", look)]] }] })
  const spinners = new Set(["·", "✢", "✳", "✶", "✻", "✽"])
  const badgeOf = (look: string) => office(one(look), 14, 0).cells[0]![7]!.ch
  for (const look of ["thinking", "editing", "reading", "searching", "running", "browsing", "delegating"]) {
    expect(spinners.has(badgeOf(look))).toBe(true)
  }
  const colours = (look: string) => new Set(office(one(look), 14, 0).cells.flat().flatMap((c) => [c.fg, c.bg]))
  expect(colours("editing").has("#6a9bcc")).toBe(true)
  expect(colours("idle").has("#6a9bcc")).toBe(false)
  expect(colours("idle").has(restingOf("#6a9bcc"))).toBe(true)
})

test("the viewer's team has a gold wall and says 你在这; the other team does not", async () => {
  const signs = ["本部", "docs 组"]
  const teams = [team(0), [seat("w", "lead", "idle")]]
  // one desk across, so each team is a band of its own beside the wall
  const drawn = office({ rooms: [{ title: "web-app 部", footer: "", signs, teams, here: 1 }] }, 20, 0)
  const rows = drawn.cells.map((line) => line.map((c) => c.ch).join(""))
  const boss = drawn.seats.find((s) => s.id === "boss")!
  const w = drawn.seats.find((s) => s.id === "w")!
  expect(rows[w.cy - 1]).toMatch(/▍doc.*◀你在这/)
  expect(rows.filter((r) => r.includes("你在这"))).toHaveLength(1)
  expect(drawn.cells[w.cy]![w.cx - 1]!.ch).toBe("┃")
  expect(drawn.cells[boss.cy]![boss.cx - 1]!.ch).not.toBe("┃")
  const alone = office({ rooms: [{ title: "web-app 部", footer: "", teams: [team(0)], here: 0 }] }, 40, 0)
  expect(alone.cells[0]!.map((c) => c.ch).join("")).toContain("web-app 部 · 你在这")
})

test("a department of several teams has a row to itself; one-team departments share rows, alike in size", async () => {
  const one = (id: string, role = "lead") => [seat(id, role, "idle")]
  const company: Company = {
    rooms: [
      { title: "web-app 部", footer: "", signs: ["本部", "a 组", "b 组"], teams: [one("hq", "leader"), one("a"), one("b")] },
      { title: "api-server 部", footer: "", teams: [one("api", "leader")] },
      { title: "web 部", footer: "", teams: [one("web", "leader")] },
    ],
  }
  const drawn = office(company, 120, 0)
  const at = (id: string) => drawn.seats.find((s) => s.id === id)!
  // the department's teams side by side, an aisle of two between them
  expect(["a", "b"].map((id) => at(id).cy)).toEqual([at("hq").cy, at("hq").cy])
  expect(["a", "b"].map((id) => at(id).cx)).toEqual([at("hq").cx + SEAT_COLS + 2, at("hq").cx + 2 * (SEAT_COLS + 2)])
  // centred in a room as wide as the pane
  expect(at("hq").cx - 1).toBe(120 - 2 - (at("b").cx + SEAT_COLS - 1))
  // the two one-team departments share the next row, in two rooms of one size
  expect(at("api").cy).toBe(at("web").cy)
  expect(at("api").cy).toBeGreaterThan(at("hq").cy + SEAT_ROWS)
  expect(at("web").cx - at("api").cx).toBe(60)
  expect(heightOf(company, 120)).toBe(1 + 1 + SEAT_ROWS + 1 + (1 + SEAT_ROWS + 1))
  // too narrow for two side by side, each one-team department takes a row
  const narrow = office(company, 34, 0).seats
  expect(narrow.find((s) => s.id === "web")!.cy).toBeGreaterThan(narrow.find((s) => s.id === "api")!.cy)
})

test("a 大部长 sits alone on the department's top row, centred, the other teams below", async () => {
  const one = (id: string, role: string) => [seat(id, role, "idle")]
  const company: Company = {
    rooms: [{ title: "web-app 部", footer: "", signs: ["本部", "a 组", "b 组"], teams: [one("hq", "chief"), one("a", "lead"), one("b", "lead")] }],
  }
  const drawn = office(company, 120, 0)
  const at = (id: string) => drawn.seats.find((s) => s.id === id)!
  expect(at("a").cy).toBe(at("b").cy)
  expect(at("a").cy).toBeGreaterThan(at("hq").cy + SEAT_ROWS)
  // centred over the row below
  expect(at("hq").cx + SEAT_COLS / 2).toBe((at("a").cx + at("b").cx + SEAT_COLS) / 2)
  expect(drawn.cells[at("hq").cy + 5]!.map((c) => c.ch).join("")).toContain("大部长")
})

test("a big office splits into bands of rows, each tree well under the serialized bound", async () => {
  const teams = Array.from({ length: 12 }, (_, i) => [
    seat(`m${i}`, i === 0 ? "chief" : "lead", "editing"),
    ...Array.from({ length: 4 }, (_, j) => seat(`m${i}c${j}`, "Explore", j % 2 ? "searching" : "reading")),
  ])
  const company: Company = {
    rooms: [{ title: "web-app 部", footer: "", signs: teams.map((_, i) => `w${i} 组`), teams }],
  }
  for (const cols of [60, 140, 300]) {
    const drawn = office(company, cols, 3)
    const slices = slicesOf(drawn.cells)
    expect(slices[0]?.[0]).toBe(0)
    expect(slices.at(-1)?.[1]).toBe(drawn.rows)
    slices.forEach(([from, to], i) => {
      if (i > 0) expect(from).toBe(slices[i - 1]?.[1])
      const tree = drawn.cells.slice(from, to).map((line) =>
        runsOf(line).map((r) => ({ type: "Text", props: { color: r.fg, backgroundColor: r.bg, bold: r.bold }, children: [r.ch] })),
      )
      expect(JSON.stringify(tree).length).toBeLessThan(100_000)
    })
  }
})

test("a resting crab's monitor stands still; a working crab's moves", async () => {
  const monitorOf = (look: string, t: number) => {
    const band: Company = { rooms: [{ title: "", footer: "", bare: true, flat: true, teams: [[seat("s", "Plan", look)]] }] }
    // the monitor sits in the seat's right five cells, on its badge row and the two below
    return office(band, SEAT_COLS, t).cells.slice(0, 3).map((line) => JSON.stringify(line.slice(9, 14)))
  }
  for (const look of ["idle", "asleep", "done", "gone"]) {
    const first = monitorOf(look, 0)
    for (let t = 1; t < 24; t++) expect(monitorOf(look, t)).toEqual(first)
  }
  const editing = Array.from({ length: 24 }, (_, t) => monitorOf("editing", t).join())
  expect(new Set(editing).size).toBeGreaterThan(1)
})
