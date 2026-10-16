// The pixel office: every seat drawn into a buffer at quadrant resolution (two
// pixels across and two down per terminal cell), then each cell turned into one
// quadrant glyph of at most two colours, which is all a cell can show. Pure, so
// the surface module draws with it every tick and the tests run it directly.

export type SeatData = {
  id: string
  role: string
  task: string
  look: string
  color: string
  // An envelope on its way along the org chart: handed down, or handed back.
  mail?: "down" | "up"
  // A manager that just finished a turn cheers; after that it keeps a mark.
  finish?: "cheer" | "done"
  // A manager's own hat, one of MANAGER_HATS; anyone else wears its role's.
  hat?: string
}
// Who said a board line; `id` is the crab's, so a click on the line finds it.
export type Speaker = { name: string; color: string; id?: string }
export type BoardLine = {
  time: string
  kind: string
  from: Speaker
  to: Speaker
  text: string
}
export type Room = {
  title: string
  footer: string
  teams: SeatData[][]
  bare?: boolean
  flat?: boolean
  // A manager in the room is cheering: the walls flash and the title says so.
  isCheering?: boolean
  // A sign per team, by the team's place in `teams`: its worktree, or 本部 for
  // the repository's own checkout. Absent, or null, and the team has no sign.
  signs?: (string | null)[]
  // The team, by its place in `teams`, of the session whose pane this is: a
  // gold wall beside it, and "你在这" on its sign, or the title without one.
  here?: number
}
export type Company = { header?: string; rooms: Room[]; board?: BoardLine[] }
export type Cell = {
  ch: string
  fg?: string
  bg?: string
  bold?: boolean
  isText?: boolean
}
export type Drawn = {
  cols: number
  rows: number
  cells: Cell[][]
  seats: { id: string; cx: number; cy: number }[]
  // Each board line's first row and the crab who said it.
  lines: { id: string; cy: number }[]
}

type Pixels = { w: number; h: number; px: (string | null)[] }
type Label = {
  x: number
  y: number
  ch?: string
  str?: string
  fg: string
  bg?: string
  bold?: boolean
  max?: number
}
type Pose = {
  eyes: keyof typeof EYES
  arms: keyof typeof ARMS
  feet: keyof typeof FEET
  dy?: number
}
type Turn = { turned: keyof typeof TURNED; dy?: number }

export const SEAT_COLS = 14
export const SEAT_ROWS = 6
// The org chart's lines hang from the middle of a desk, cells 1 to 13 of a seat.
const DESK_MID = 7

const QUAD: Record<string, number> = {
  " ": 0,
  "▘": 8,
  "▝": 4,
  "▖": 2,
  "▗": 1,
  "▀": 12,
  "▄": 3,
  "▌": 10,
  "▐": 5,
  "▚": 9,
  "▞": 6,
  "▛": 14,
  "▜": 13,
  "▙": 11,
  "▟": 7,
  "█": 15,
}
const GLYPH: string[] = []
for (const [ch, mask] of Object.entries(QUAD)) GLYPH[mask] = ch

export const LEADER_COLOR = "#d77757" // Claude Code's own clawd_body
const EYE = "#000000" // clawd_background
const GONE = "#6f6a62"
const FLOOR = "#2a2521"
const CHALKBOARD = "#2e3a33"
const WIRE = "#8a7f72"
const TITLE = "#e6e0d6"
const MUTED = "#8f8b80"
const HERE = "#e8c468" // the 大部长's crown
const YOU_ARE_HERE = "◀你在这"
const OAK = {
  edge: "#b8875a",
  top: "#966a45",
  front: "#6b4a31",
  leg: "#4a3322",
}
const WALNUT = {
  edge: "#8f5b3a",
  top: "#6f4127",
  front: "#4e2c1a",
  leg: "#38200f",
}
const NAMEPLATE = "#e8c468"
const DONE_GREEN = "#7ac47a"
const MONITOR = "#4a4f59"
const MONITOR_EDGE = "#6b717d"
const KEYS = "#4b4f58"
const KEY_LIT = "#d6dae0"
const CHAIR = "#4b4f58"
const STICKY = "#f2d25c"
const MUG = "#ece6da"
const STEAM = "#8f8b80"
const SWEAT = "#7fb4e8"
const SPIN = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"]

// Clawd's parts as Claude Code 2.1.301 draws him: arms either side of the eyes
// on the top row, the body under them, the feet below; and the turned frames,
// whose [from, to) cells show clawd_background through their open quadrants.
const ARMS = {
  down: { r1L: " ▐", r1R: "", r2L: "▝▜", r2R: "█▀" },
  up: { r1L: "▗▟", r1R: "▄", r2L: " ▜", r2R: "█▘" },
  "one-up": { r1L: " ▐", r1R: "▄", r2L: "▝▜", r2R: "█▘" },
}
// Eyes as pixels on the head's lower row, from the crab's left edge: an open
// eye is clawd_background, a shut one the same pixel in a lid of darker body.
// Claude Code's lid glyph, drawn as pixels, came out half a cell tall and twice
// an open eye's width. There is no blink: at one pixel an eye that shuts reads
// as swelling, vanishing or fading, and all three were tried.
type Eye = [dx: number, dy: number, isShut: boolean]
const EYES: Record<string, Eye[]> = {
  open: [[5, 1, false], [13, 1, false]],
  left: [[4, 1, false], [12, 1, false]],
  right: [[6, 1, false], [14, 1, false]],
  closed: [[5, 1, true], [13, 1, true]],
  wink: [[5, 1, false], [13, 1, true]],
}

export function lidOf(body: string): string {
  const n = parseInt(body.slice(1), 16)
  const dark = (shift: number) => Math.round(((n >> shift) & 255) * 0.62)
  return `#${[16, 8, 0].map((s) => dark(s).toString(16).padStart(2, "0")).join("")}`
}
const FEET = { both: " ▝▝   ▝▝ ", left: " ▝▝      ", right: "      ▝▝ " }
const TURNED: Record<string, [string, number, number][]> = {
  "right-12": [
    [" ▐█▜██▛█ ", 2, 8],
    ["▝▜██████▀", 2, 7],
    [" ▝▝   ▝▝ ", 0, 0],
  ],
  "right-30": [
    ["  █▛██▛▌ ", 2, 7],
    [" ▝█████▛ ", 2, 7],
    ["  ▘▘  ▘▘ ", 0, 0],
  ],
  "left-12": [
    [" ▐▛███▜█ ", 2, 8],
    ["▝▜██████▀", 2, 7],
    [" ▝▝   ▝▝ ", 0, 0],
  ],
}

const TITLES: Record<string, string> = {
  // A session in the repository's own checkout heads the department; one in a
  // worktree leads a team inside it; one 部长 in the company is the 大部长.
  chief: "大部长",
  leader: "部长",
  lead: "组长",
  Explore: "调研员",
  Plan: "规划师",
  "general-purpose": "工程师",
  fork: "分身",
  "claude-code-guide": "顾问",
  verifier: "质检员",
}

export function titleOf(role: string): string {
  return TITLES[role] ?? "实习生"
}

// Hats sit on the two pixel rows above the head. The crown is the 大部长's
// alone; when every manager wore one, a crown said nothing.
const HATS: Record<string, { color: string; rows: [string, string] }> = {
  chief: { color: "#e8c468", rows: ["   █  █  █   ", "   ███████   "] },
  mortarboard: { color: "#3fa598", rows: [" ███████████ ", "    █████ █  "] },
  chef: { color: "#efe9dc", rows: ["   ███████   ", "    █████    "] },
  viking: { color: "#b7c3d3", rows: ["█           █", " ███████████ "] },
  beanie: { color: "#e07aa8", rows: ["      █      ", "   ███████   "] },
  bunny: { color: "#b9a3e3", rows: ["   █     █   ", "   ██   ██   "] },
  cowboy: { color: "#8a5a32", rows: ["    ██ ██    ", "█████████████"] },
  propeller: { color: "#4fb3d9", rows: ["  ███ █ ███  ", "    █████    "] },
  Explore: { color: "#c2a878", rows: ["    █████    ", " ███████████ "] },
  Plan: { color: "#7d8fc4", rows: ["   ███████   ", "  ███████████"] },
  "general-purpose": {
    color: "#f2c037",
    rows: ["    █████    ", "  █████████  "],
  },
  fork: { color: "#8da563", rows: ["      █      ", "     ███     "] },
}

// Every manager but the 大部长 wears one of these, no two alike while they last.
export const MANAGER_HATS = ["mortarboard", "chef", "viking", "beanie", "bunny", "cowboy", "propeller"]

function set(b: Pixels, x: number, y: number, c: string) {
  if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.px[y * b.w + x] = c
}

function fill(
  b: Pixels,
  x0: number,
  y0: number,
  w: number,
  h: number,
  c: string,
) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) set(b, x, y, c)
}

// One row of glyph cells as pixels; cells in [from, to) show clawd_background
// through their open quadrants.
function glyphs(
  b: Pixels,
  x0: number,
  y0: number,
  text: string,
  fg: string,
  from = 0,
  to = 0,
) {
  Array.from(text).forEach((ch, i) => {
    const x = x0 + 2 * i
    const mask = QUAD[ch] ?? 0
    const isOpen = i >= from && i < to
    for (const [bit, dx, dy] of [
      [8, 0, 0],
      [4, 1, 0],
      [2, 0, 1],
      [1, 1, 1],
    ] as const) {
      if (mask & bit) set(b, x + dx, y0 + dy, fg)
      else if (isOpen) set(b, x + dx, y0 + dy, EYE)
    }
  })
}

function clawd(b: Pixels, x: number, y: number, pose: Pose, body: string) {
  const arms = ARMS[pose.arms]
  glyphs(b, x, y, arms.r1L, body)
  glyphs(b, x + 4, y, "██████", body)
  for (const [dx, dy, isShut] of EYES[pose.eyes] ?? []) set(b, x + dx, y + dy, isShut ? lidOf(body) : EYE)
  glyphs(b, x + 16, y, arms.r1R, body)
  glyphs(b, x, y + 2, arms.r2L, body)
  glyphs(b, x + 4, y + 2, "█████", body)
  glyphs(b, x + 14, y + 2, arms.r2R, body)
  glyphs(b, x, y + 4, FEET[pose.feet], body)
}

function turned(b: Pixels, x: number, y: number, name: string, body: string) {
  ;(TURNED[name] ?? []).forEach(([g, from, to], i) =>
    glyphs(b, x, y + 2 * i, g, body, from, to),
  )
}

function hat(b: Pixels, x: number, y: number, role: string, isResting: boolean) {
  const h = HATS[role]
  if (h === undefined) return
  const color = isResting ? restingOf(h.color) : h.color
  h.rows.forEach((row, dy) =>
    Array.from(row).forEach((ch, dx) => {
      if (ch === "█") set(b, x + dx, y + dy, color)
    }),
  )
}

// A crab at rest fades two-fifths of the way into the floor, so a glance tells
// the working, in full colour, from the resting.
export function restingOf(color: string): string {
  const [a, b] = [parseInt(color.slice(1), 16), parseInt(FLOOR.slice(1), 16)]
  const mix = (shift: number) => Math.round(((a >> shift) & 255) * 0.6 + ((b >> shift) & 255) * 0.4)
  return `#${[16, 8, 0].map((s) => mix(s).toString(16).padStart(2, "0")).join("")}`
}

// Every look of a crab at work wears Claude Code's own spinner over its head.
const WORKING = new Set(["thinking", "editing", "reading", "searching", "running", "browsing", "delegating"])

// The screen's whole picture: three rows of three two-pixel blocks.
function screen(look: string, t: number): string[][] {
  const k = (n: number) => ((t % n) + n) % n
  const rows3 = (pick: (r: number, i: number) => string) => [0, 1, 2].map((r) => [0, 1, 2].map((i) => pick(r, i)))
  switch (look) {
    // A working screen is lit edge to edge, with a few pixels moving on it; only
    // standby and sleep are dark, so a lit screen means work.
    case "editing": {
      // An editor: lines typed out a block at a time on a lit page, then a fresh one.
      const [bg, code] = ["#3a6ea5", ["#ffe08a", "#ffffff", "#a8f0b4", "#ffb3c7"]]
      const page = Math.floor(t / 15)
      return rows3((r, i) => (r * 3 + i < k(15) - 2 ? (code[(r + i + page) % 4] ?? "#ffffff") : bg))
    }
    case "running": {
      const [ink, bg] = ["#c8ffd2", "#2f8f4f"]
      const lines = [[ink, ink, ink], [ink, bg, bg], [ink, ink, bg], [bg, bg, bg], [ink, ink, ink], [ink, bg, bg]]
      return [0, 1, 2].map((r) => lines[(r + k(6)) % 6] ?? [bg, bg, bg])
    }
    case "reading": {
      const [ink, bg] = ["#8a8578", "#f2eee4"]
      const lines = [[ink, ink, ink], [ink, ink, bg], [bg, bg, bg], [ink, ink, ink], [ink, bg, bg]]
      return [0, 1, 2].map((r) => lines[(r + Math.floor(t / 3)) % 5] ?? [bg, bg, bg])
    }
    case "searching": {
      const at = Math.floor(t / 2) % 9
      return rows3((r, i) => (r * 3 + i === at ? "#fff3a8" : "#4f86c6"))
    }
    case "browsing": {
      const [sky, hill, sun] = ["#7fb4e8", "#6f9e57", "#ffffff"]
      const at = Math.floor(t / 3) % 3
      return [[0, 1, 2].map((i) => (i === at ? sun : sky)), [sky, sky, sky], [hill, sky, hill]]
    }
    case "thinking": {
      // A loading row of dots walking across a lit screen.
      const at = k(3)
      return rows3((r, i) => (r === 1 && i === at ? "#ffffff" : "#7a6fc4"))
    }
    case "approval": {
      // A dialog on an amber screen, its button pulsing.
      const [bg, box, button] = ["#d9a93f", "#fff6dc", k(6) < 4 ? "#7a4f12" : "#d9a93f"]
      return [[bg, bg, bg], [box, box, box], [bg, button, bg]]
    }
    case "done":
      return rows3((r, i) => (r === 1 && i === 1 ? "#ffffff" : "#3f8f4f"))
    case "failed":
      return rows3((r, i) => (r === 1 && i === 1 ? "#ffffff" : "#a8473c"))
    case "asleep":
    case "gone":
      return rows3(() => "#101318")
    case "idle":
      // Standby, and still: a crab at rest has nothing moving on its screen.
      return rows3((r, i) => (r === 1 && i === 1 ? LEADER_COLOR : "#1f2633"))
    default: {
      // Delegating: a Claude-orange spark drifts across a slate screen while
      // the crew works.
      const at = Math.floor(t / 3) % 9
      return rows3((r, i) => (r * 3 + i === at ? LEADER_COLOR : "#1f2633"))
    }
  }
}

// Ten pixels wide: bezels two pixels at the sides and one above and below,
// which read as even since a pixel here is twice as tall as it is wide; a lit
// top edge and a neck to the desk. A power light on the bezel was dropped: the
// screen already says what the crab is doing.
// It stands at the desk's right end, clear of the crab's arm: drawn in front of
// it, the monitor hid his hand.
function monitor(b: Pixels, mx: number, my: number, look: string, t: number) {
  fill(b, mx, my, 10, 5, MONITOR)
  fill(b, mx, my, 10, 1, MONITOR_EDGE)
  fill(b, mx + 4, my + 5, 2, 1, MONITOR)
  screen(look, t).forEach((blocks, r) =>
    blocks.forEach((c, i) => fill(b, mx + 2 + 2 * i, my + 1 + r, 2, 1, c)),
  )
}

function keyboard(b: Pixels, x: number, y: number, look: string, t: number) {
  for (let i = 0; i < 4; i++) {
    const isLit = look === "editing" && (t * 3 + i * 5) % 7 === 0
    fill(b, x + 2 * i, y, 2, 1, isLit ? KEY_LIT : KEYS)
  }
}

function phaseOf(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0
  return h % 23
}

// Turned to the monitor while working at it, facing you otherwise; `dy` lowers
// the crab, so asleep his head rests behind the desk.
function poseOf(look: string, t: number, ph: number): Pose | Turn {
  const k = (t + ph) % 16
  switch (look) {
    case "editing":
      return { turned: (t + ph) % 10 < 7 ? "right-30" : "right-12" }
    case "running":
    case "reading":
      return { turned: "right-30" }
    case "browsing":
      return { turned: "right-12" }
    case "searching":
      return {
        turned: Math.floor((t + ph) / 4) % 2 === 0 ? "left-12" : "right-12",
      }
    case "thinking": {
      // Looks ahead, to one side, ahead, to the other: thinking it over.
      const glance = (["open", "left", "open", "right"] as const)[Math.floor((t + ph) / 4) % 4] ?? "open"
      return { eyes: glance, arms: "down", feet: "both" }
    }
    case "delegating":
      return {
        eyes: "open",
        arms: Math.floor((t + ph) / 4) % 2 === 0 ? "up" : "one-up",
        feet: "both",
      }
    case "approval":
      return { eyes: "open", arms: "one-up", feet: "both" }
    case "asleep":
      return { eyes: "closed", arms: "down", feet: "both", dy: 2 }
    case "done":
      return k < 6
        ? { eyes: "open", arms: "up", feet: "both" }
        : { eyes: "wink", arms: "down", feet: "both" }
    case "failed":
      return { eyes: "closed", arms: "down", feet: "both" }
    default:
      return { eyes: "open", arms: "down", feet: "both" }
  }
}

function badges(
  look: string,
  t: number,
  ph: number,
  color: string,
): Omit<Label, "y">[] {
  const k = (t + ph) % 16
  const blinkOn = Math.floor(t / 3) % 2 === 0
  if (WORKING.has(look)) {
    const spinner = { x: 7, ch: SPIN[(t + ph) % SPIN.length], fg: LEADER_COLOR, bold: true }
    return look === "delegating" ? [spinner, { x: 8, ch: "»", fg: color, bold: true }] : [spinner]
  }
  switch (look) {
    case "approval":
      return blinkOn ? [{ x: 7, ch: "!", fg: "#f2c037", bold: true }] : []
    case "asleep": {
      const z = Math.floor((t + ph) / 4) % 3
      const small = { x: 7, ch: "z", fg: MUTED }
      const big = { x: 8, ch: "Z", fg: MUTED }
      return z === 0 ? [small] : z === 1 ? [small, big] : [big]
    }
    case "done":
      return k < 6
        ? [{ x: 7, ch: k % 2 === 0 ? "✦" : "✧", fg: NAMEPLATE, bold: true }]
        : [{ x: 7, ch: "✓", fg: "#7ac47a", bold: true }]
    case "failed":
      return blinkOn ? [{ x: 7, ch: "×", fg: "#e06c5a", bold: true }] : []
    default:
      return []
  }
}

// One workstation at cell (cx, cy): cy is the badge row, four rows of art
// follow, then the job title and the task.
function drawSeat(
  b: Pixels,
  labels: Label[],
  cx: number,
  cy: number,
  seat: SeatData,
  t: number,
  isSelected: boolean,
) {
  const X = cx * 2
  const Y = (cy + 1) * 2
  const ph = phaseOf(seat.id)
  const { look } = seat
  const isGone = look === "gone"
  const isResting = (look === "idle" || look === "asleep") && seat.finish !== "cheer"
  const body = isGone ? GONE : isResting ? restingOf(seat.color) : seat.color
  const isManager = seat.role === "chief" || seat.role === "leader" || seat.role === "lead"
  const desk = isManager ? WALNUT : OAK

  if (isGone) {
    fill(b, X + 5, Y + 1, 6, 1, CHAIR)
    fill(b, X + 4, Y + 2, 8, 2, CHAIR)
  } else {
    const pose: Pose | Turn =
      seat.finish === "cheer"
        ? { eyes: "open", arms: (t + ph) % 4 < 2 ? "up" : "one-up", feet: "both" }
        : poseOf(look, t, ph)
    const dy = pose.dy ?? 0
    // Two pixels left of the head's centre: cell 7 of this row is the badge's,
    // and a centred hat lost its right edge under the spinner.
    hat(b, X + 1, Y - 2 + dy, seat.hat ?? seat.role, isResting)
    if ("turned" in pose) turned(b, X, Y + dy, pose.turned, body)
    else clawd(b, X, Y + dy, pose, body)
  }
  monitor(b, X + 18, Y - 2, look, t + ph)
  if (isGone) fill(b, X + 26, Y - 2, 2, 2, STICKY)
  // Waiting for you, he holds a mug, and now and then takes a sip.
  if (look === "idle" && seat.finish !== "cheer") {
    if ((t + ph) % 20 < 3) fill(b, X, Y, 2, 2, MUG)
    else {
      fill(b, X, Y + 2, 2, 2, MUG)
      const s = Math.floor((t + ph) / 3) % 2
      set(b, X + s, Y + 1, STEAM)
      set(b, X + 1 - s, Y, STEAM)
    }
  }
  if (look === "failed") set(b, X + 1, Y, SWEAT)
  // Each desk starts a cell into its seat, so a row reads as separate
  // workstations rather than one bench, and runs to the seat's end under the
  // monitor.
  fill(b, X + 2, Y + 4, 26, 1, desk.edge)
  fill(b, X + 2, Y + 5, 26, 1, desk.top)
  fill(b, X + 3, Y + 6, 24, 1, desk.front)
  fill(b, X + 4, Y + 7, 2, 1, desk.leg)
  fill(b, X + 24, Y + 7, 2, 1, desk.leg)
  // The keyboard sits in front of the crab, clear of the monitor's neck.
  keyboard(b, X + 4, Y + 4, look, t + ph)
  if (isManager) fill(b, X + 4, Y + 6, 6, 1, NAMEPLATE)

  if (!isGone)
    for (const mark of finishBadges(seat.finish, t) ?? badges(look, t, ph, body))
      labels.push({ ...mark, x: cx + mark.x, y: cy })
  const title = titleOf(seat.role)
  const nameColor = isGone ? GONE : body
  if (isSelected) {
    const line = fit(`${title} ${seat.task}`, SEAT_COLS - 1)
    labels.push({
      x: cx,
      y: cy + 5,
      str: line.padEnd(SEAT_COLS - 1 - (width(line) - line.length)),
      fg: EYE,
      bg: nameColor,
      bold: true,
    })
    return
  }
  labels.push({
    x: cx,
    y: cy + 5,
    str: title,
    fg: nameColor,
    bold: !isGone,
    max: SEAT_COLS - 1,
  })
  const used = width(title) + 1
  const isCheering = seat.finish === "cheer"
  if (seat.task || isCheering)
    labels.push({
      x: cx + used,
      y: cy + 5,
      str: isCheering ? "完成了！" : seat.task,
      fg: isGone ? GONE : isCheering ? DONE_GREEN : MUTED,
      bold: isCheering,
      max: SEAT_COLS - 1 - used,
    })
}

// Sparks either side of the head while cheering, then a check that stays.
function finishBadges(finish: SeatData["finish"], t: number): Omit<Label, "y">[] | undefined {
  if (finish === "cheer") {
    const [a, b] = t % 2 === 0 ? ["✦", "✧"] : ["✧", "✦"]
    return [
      { x: 0, ch: a, fg: NAMEPLATE, bold: true },
      { x: 7, ch: b, fg: NAMEPLATE, bold: true },
    ]
  }
  if (finish === "done") return [{ x: 7, ch: "✓", fg: DONE_GREEN, bold: true }]
  return undefined
}

function chunks<T>(list: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n))
  return out
}

type Row = {
  seats: SeatData[]
  isCentered: boolean
  isWired: boolean
  isFromManager: boolean
  isManager: boolean
  // Crew past the desks shown, drawn as one line of heads instead of desks.
  crowd?: SeatData[]
}

// A team keeps at most two rows of crew desks; the rest wait in a crowd line.
// The desks go in hiring order, so nobody moves desk while the crowd drains.
const CREW_ROWS = 2

// A team as an org chart: the manager's desk on a row of its own, the crew on
// the rows below, each crew row hung from a line; a flat team is a plain grid.
function rowsOf(team: SeatData[], perRow: number, isFlat: boolean): Row[] {
  if (isFlat) {
    return chunks(team, perRow).map((seats) => ({
      seats,
      isCentered: false,
      isWired: false,
      isFromManager: false,
      isManager: false,
    }))
  }
  const [manager, ...crew] = team
  const rows: Row[] =
    manager === undefined
      ? []
      : [
          {
            seats: [manager],
            isCentered: true,
            isWired: false,
            isFromManager: false,
            isManager: true,
          },
        ]
  const shown = crew.slice(0, perRow * CREW_ROWS)
  chunks(shown, perRow).forEach((seats, i) =>
    rows.push({
      seats,
      isCentered: true,
      isWired: true,
      isFromManager: i === 0,
      isManager: false,
    }),
  )
  const crowd = crew.slice(shown.length)
  if (crowd.length > 0) {
    rows.push({ seats: [], isCentered: false, isWired: false, isFromManager: false, isManager: false, crowd })
  }
  return rows
}

function teamHeight(team: SeatData[], perRow: number, isFlat: boolean): number {
  return rowsOf(team, perRow, isFlat).reduce(
    (n, row) => n + (row.crowd ? 1 : SEAT_ROWS + (row.isWired ? 1 : 0)),
    0,
  )
}

// A department's teams sit side by side while they fit across, each as wide as
// its widest row of desks, an aisle between two; one team to a row left one desk
// alone on a floor as wide as the pane. A band of teams is as tall as its
// tallest. The strip above the prompt keeps its one team on one row.
type Block = { team: SeatData[]; index: number; seats: number; height: number }

// Floor kept clear inside each side wall, and between two teams of a band.
const PAD = 2
const AISLE = 2
const ROOM_GAP = 1

function bandsOf(room: Room, across: number): Block[][] {
  const isFlat = room.flat === true
  const perRow = isFlat ? Math.max(1, ...room.teams.map((t) => t.length)) : Math.max(1, Math.floor(across / SEAT_COLS))
  const bands: Block[][] = []
  let used = Number.POSITIVE_INFINITY
  room.teams.forEach((team, index) => {
    const seats = isFlat ? perRow : Math.max(1, Math.min(perRow, team.length - 1))
    const height = teamHeight(team, seats, isFlat) + (room.signs?.[index] ? 1 : 0)
    if (used + AISLE + seats * SEAT_COLS > across) {
      bands.push([])
      used = -AISLE
    }
    bands[bands.length - 1]?.push({ team, index, seats, height })
    used += AISLE + seats * SEAT_COLS
    // A 大部长 sits on the top row alone, the department's other teams below.
    if (team[0]?.role === "chief") used = Number.POSITIVE_INFINITY
  })
  return bands
}

function tallest(band: Block[]): number {
  return Math.max(...band.map((block) => block.height))
}

function bandWidth(band: Block[]): number {
  return band.reduce((n, block) => n + block.seats * SEAT_COLS, 0) + AISLE * (band.length - 1)
}

function titleOfRoom(room: Room, isCheering: boolean): string {
  const isHereUnsigned = room.here !== undefined && !room.signs?.[room.here]
  return `${room.title}${isHereUnsigned ? " · 你在这" : ""}${isCheering ? " ✓ 完成" : ""}`
}

type Placed = { room: Room; x: number; y: number; w: number; h: number; bands: Block[][] }

// A department of several teams has a row of the pane to itself. Departments of
// one team share rows, every one as wide as the widest needs and together
// filling the row; a last row they do not fill is centred. Rooms of a row are as
// tall as its tallest. A room is sized to its cheering title, so it does not
// grow as it cheers.
function layoutOf(company: Company, cols: number): { rooms: Placed[]; bottom: number } {
  const insideOf = (w: number) => w - 2 - 2 * PAD
  const isShared = (room: Room) => !room.bare && room.teams.length <= 1
  const shared = company.rooms.filter(isShared)
  const least = Math.max(
    0,
    ...shared.map(
      (room) =>
        Math.max(
          ...bandsOf(room, insideOf(cols)).map(bandWidth),
          width(titleOfRoom(room, true)) + 4,
          width(room.footer) + DOOR + 6,
        ) +
        2 +
        2 * PAD,
    ),
  )
  const perLine = Math.max(1, Math.min(shared.length, Math.floor((cols + ROOM_GAP) / (least + ROOM_GAP))))
  const sharedWidth = Math.min(cols, Math.floor((cols - (perLine - 1) * ROOM_GAP) / perLine))
  const lines: Room[][] = []
  for (const room of company.rooms) {
    if (!isShared(room)) lines.push([room])
    else if (room === shared[0]) lines.push(...chunks(shared, perLine))
  }
  const rooms: Placed[] = []
  let y = company.header ? 1 : 0
  for (const line of lines) {
    const placed = line.map((room) => {
      // A bare strip keeps its team on one row; seats past the edge are clipped.
      const w = room.bare ? Math.max(1, ...room.teams.map((t) => t.length)) * SEAT_COLS : isShared(room) ? sharedWidth : cols
      const bands = bandsOf(room, room.bare ? w : insideOf(w))
      const floor = bands.reduce((n, band) => n + tallest(band) + (room.bare ? 0 : 1), 0)
      return { room, w, bands, h: room.bare ? floor : 1 + floor }
    })
    const h = Math.max(...placed.map((p) => p.h))
    const across = placed.reduce((n, p) => n + p.w, 0) + ROOM_GAP * (placed.length - 1)
    let x = line[0]?.bare ? 0 : Math.max(0, Math.floor((cols - across) / 2))
    for (const p of placed) {
      rooms.push({ ...p, x, y, h })
      x += p.w + ROOM_GAP
    }
    y += h
  }
  return { rooms, bottom: y }
}

// Each team of a department sits on its own rug, its sign in the rug's ink;
// 本部 keeps the plain floor.
const RUGS = [
  { floor: "#2c2732", ink: "#b49ad1" },
  { floor: "#262e29", ink: "#8fc29a" },
  { floor: "#2e2a23", ink: "#d6b26a" },
  { floor: "#252b33", ink: "#8fb3db" },
  { floor: "#312725", ink: "#d99a8a" },
]
export const HQ = "本部"

function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

function rugOf(sign: string): { floor: string; ink: string } {
  if (sign === HQ) return { floor: FLOOR, ink: TITLE }
  return RUGS[hashOf(sign) % RUGS.length] ?? { floor: FLOOR, ink: TITLE }
}

// Two rows a line: who said it to whom, then what was said.
function boardHeight(company: Company): number {
  if (company.board === undefined) return 0
  return 2 + Math.max(1, company.board.length * 2)
}

export function heightOf(company: Company, cols: number): number {
  return (
    layoutOf(company, cols).bottom + boardHeight(company)
  )
}

const LINE: Record<string, string> = {
  lr: "─",
  lrd: "┬",
  lru: "┴",
  lrud: "┼",
  rd: "┌",
  ld: "┐",
  ru: "└",
  lu: "┘",
  rud: "├",
  lud: "┤",
  d: "╷",
  ud: "│",
}

// The envelope walks the wire from the manager's junction to the crew's, or
// back, then rests a beat at the far end before it sets out again.
function envelope(
  labels: Label[],
  y: number,
  from: number,
  to: number,
  t: number,
) {
  const length = Math.abs(to - from)
  const step = Math.min(t % (length + 3), length)
  labels.push({
    x: from + Math.sign(to - from) * step,
    y,
    ch: "✉",
    fg: NAMEPLATE,
    bold: true,
  })
}

function board(
  b: Pixels,
  labels: Label[],
  y: number,
  w: number,
  lines: BoardLine[],
  selected: string | null,
  links: Drawn["lines"],
) {
  const h = 2 + Math.max(1, lines.length * 2)
  fill(b, 2, (y + 1) * 2, (w - 2) * 2, (h - 2) * 2, CHALKBOARD)
  frame(labels, y, w, h, "共享白板", lines.length > 0 ? `最近 ${lines.length} 条` : "")
  if (lines.length === 0) {
    labels.push({ x: 2, y: y + 1, str: "还没有人说话", fg: MUTED })
    return
  }
  lines.forEach((line, i) => {
    const row = y + 1 + 2 * i
    let x = 2
    const say = (str: string, fg: string, bold = false) => {
      const shown = fit(str, w - 2 - x)
      labels.push({ x, y: row, str: shown, fg, bold })
      x += width(shown)
    }
    if (line.from.id !== undefined) links.push({ id: line.from.id, cy: row })
    if (line.from.id !== undefined && line.from.id === selected) {
      labels.push({ x: 1, y: row, ch: "▸", fg: line.from.color, bold: true })
    }
    say(`${line.time} `, MUTED)
    say(line.from.name, line.from.color, true)
    say(" → ", MUTED)
    say(line.to.name, line.to.color, true)
    labels.push({ x: 4, y: row + 1, str: line.text, fg: TITLE, max: w - 6 })
  })
}

// "还有 6 人" then a head for each, in its own colour; heads past the wall fold
// into the count.
function crowdLine(labels: Label[], x: number, y: number, w: number, crowd: SeatData[]) {
  const head = `还有 ${crowd.length} 人 `
  labels.push({ x: x + 1, y, str: head, fg: MUTED })
  const room = Math.max(0, w - 2 - width(head))
  crowd.slice(0, room).forEach((seat, i) => {
    labels.push({ x: x + 1 + width(head) + i, y, ch: seat.look === "gone" ? "▂" : "▄", fg: seat.look === "gone" ? GONE : seat.color })
  })
}

function wire(
  labels: Label[],
  y: number,
  crew: number[],
  manager: number | null,
) {
  const points = manager === null ? crew : [...crew, manager]
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  for (let x = lo; x <= hi; x++) {
    const dirs = `${x > lo ? "l" : ""}${x < hi ? "r" : ""}${x === manager ? "u" : ""}${crew.includes(x) ? "d" : ""}`
    labels.push({ x, y, ch: LINE[dirs] ?? "─", fg: WIRE })
  }
}

const WALL = "#a39a8f"
const PLATE = { fg: "#2a2521", bg: "#d9b86a" }
const DOOR = 4
const CARPET = "#2e2924"

// Carpet tiles a shade apart, four cells by two, laid from the room's corner.
function carpet(b: Pixels, at: { x: number; y: number; w: number; h: number }) {
  for (let y = 0; y < at.h; y++)
    for (let x = 0; x < at.w; x++) {
      const isOdd = (Math.floor(x / 4) + Math.floor(y / 2)) % 2 === 1
      fill(b, (at.x + x) * 2, (at.y + y) * 2, 2, 2, isOdd ? CARPET : FLOOR)
    }
}

// A floor lamp by the wall of each room, the one piece of furniture: a plant,
// a water cooler, a bookshelf, a printer, a cabinet and a sofa were tried and
// read as misshapen at two pixels a cell. Letters are colours, a space floor;
// the pole is two pixels wide so it stands centred under the shade.
const LAMP = [" yy ", "yyyy", " kk ", " kk ", " kk ", " kk ", " kk ", "kkkk"]
const LAMP_INK: Record<string, string> = { y: "#f2d27a", k: "#5a5d63" }

// The lamp stands on the floor where the first row of desks does, by the left
// wall, when the floor there is clear of the desks and the viewer's mark.
function lamp(b: Pixels, wall: number, band: { from: number; row: number }) {
  const x = wall + 2
  if (x + 2 > band.from - 1) return
  const top = 2 * band.row + 10 - LAMP.length
  LAMP.forEach((line, dy) =>
    Array.from(line).forEach((ch, dx) => {
      const color = LAMP_INK[ch]
      if (color !== undefined) set(b, x * 2 + dx, top + dy, color)
    }),
  )
}

// A room as a floor plan: double walls, the department's name on a brass plate
// over the top wall, and the head-count along the bottom one beside a doorway.
function walls(
  b: Pixels,
  labels: Label[],
  at: { x: number; y: number; w: number; h: number },
  title: string,
  footer: string,
  accent?: string,
) {
  const { x, y, w, h } = at
  const wall = accent ?? WALL
  const plate = fit(` ${title} `, w - 6)
  labels.push({ x, y, str: "╔═╡", fg: wall })
  labels.push({ x: x + 3, y, str: plate, fg: PLATE.fg, bg: PLATE.bg, bold: true })
  labels.push({ x: x + 3 + width(plate), y, str: `╞${"═".repeat(Math.max(0, w - 5 - width(plate)))}╗`, fg: wall })
  for (let r = y + 1; r < y + h - 1; r++) {
    labels.push({ x, y: r, ch: "║", fg: wall })
    labels.push({ x: x + w - 1, y: r, ch: "║", fg: wall })
  }
  const bottom = y + h - 1
  const door = x + w - 3 - DOOR
  const shown = fit(footer, w - DOOR - 9)
  labels.push({ x, y: bottom, str: "╚═ ", fg: wall })
  labels.push({ x: x + 3, y: bottom, str: shown, fg: MUTED })
  labels.push({ x: x + 3 + width(shown), y: bottom, str: ` ${"═".repeat(Math.max(0, door - x - 5 - width(shown)))}╡`, fg: wall })
  // The doorway is floor, running out through the wall.
  fill(b, door * 2, bottom * 2, DOOR * 2, 2, FLOOR)
  labels.push({ x: door + DOOR, y: bottom, str: "╞═╝", fg: wall })
}

const BOARD_EDGE = "#b8bcc2"
const MARKERS = ["#d9534f", "#4a7fd0", "#5aa05a"]

// The board as a whiteboard on the wall: an aluminium frame, and markers lying in
// the tray along its bottom.
function frame(labels: Label[], y: number, w: number, h: number, title: string, footer: string) {
  const edge = (row: number, left: string, right: string, text: string, color: string, isBold: boolean) => {
    const shown = fit(text, w - 16)
    labels.push({ x: 0, y: row, str: `${left}━ `, fg: BOARD_EDGE })
    labels.push({ x: 3, y: row, str: shown, fg: color, bold: isBold })
    labels.push({ x: 3 + width(shown), y: row, str: ` ${"━".repeat(Math.max(0, w - 5 - width(shown)))}${right}`, fg: BOARD_EDGE })
  }
  edge(y, "┏", "┓", title, TITLE, true)
  for (let r = y + 1; r < y + h - 1; r++) {
    labels.push({ x: 0, y: r, ch: "┃", fg: BOARD_EDGE })
    labels.push({ x: w - 1, y: r, ch: "┃", fg: BOARD_EDGE })
  }
  edge(y + h - 1, "┗", "┛", footer, MUTED, false)
  if (w >= 24) MARKERS.forEach((color, i) => labels.push({ x: w - 12 + i * 3, y: y + h - 1, str: "▬▬", fg: color }))
}

// One team at column x of its band: its sign and rug, then the org chart.
function drawTeam(
  b: Pixels,
  labels: Label[],
  placed: Drawn["seats"],
  room: Room,
  block: Block,
  at: { x: number; y: number; tall: number },
  t: number,
  selected: string | null,
) {
  const w = block.seats * SEAT_COLS
  const sign = room.signs?.[block.index]
  const isHere = block.index === room.here && !room.bare
  let y = at.y
  if (sign) {
    const rug = rugOf(sign)
    fill(b, at.x * 2, y * 2, w * 2, at.tall * 2, rug.floor)
    // On a narrow team the sign gives way to the marker, not the other way.
    const shown = fit(`▍${sign}`, isHere ? w - 2 - width(YOU_ARE_HERE) : w - 1)
    labels.push({ x: at.x + 1, y, str: shown, fg: rug.ink, bold: true })
    if (isHere) labels.push({ x: at.x + 2 + width(shown), y, str: YOU_ARE_HERE, fg: HERE, bold: true })
    y += 1
  }
  let managerMid: number | null = null
  for (const row of rowsOf(block.team, block.seats, room.flat === true)) {
    if (row.crowd) {
      crowdLine(labels, at.x, y, w, row.crowd)
      y += 1
      continue
    }
    const start = at.x + (row.isCentered ? Math.floor((w - row.seats.length * SEAT_COLS) / 2) : 0)
    if (row.isWired) {
      const mids = row.seats.map((_, i) => start + i * SEAT_COLS + DESK_MID)
      const boss = row.isFromManager ? managerMid : null
      wire(labels, y, mids, boss)
      if (boss !== null) {
        row.seats.forEach((seat, i) => {
          const mid = mids[i] ?? boss
          if (seat.mail === "down") envelope(labels, y, boss, mid, t)
          if (seat.mail === "up") envelope(labels, y, mid, boss, t)
        })
      }
      y += 1
    }
    row.seats.forEach((seat, i) => {
      const cx = start + i * SEAT_COLS
      drawSeat(b, labels, cx, y, seat, t, seat.id === selected)
      placed.push({ id: seat.id, cx, cy: y })
    })
    if (row.isManager) managerMid = start + DESK_MID
    y += SEAT_ROWS
  }
  // In the aisle or the clear floor beside the team, which nothing else draws on.
  if (isHere)
    for (let r = at.y; r < at.y + at.tall; r++) labels.push({ x: at.x - 1, y: r, ch: "┃", fg: HERE, bold: true })
}

export function office(
  company: Company,
  cols: number,
  t: number,
  selected: string | null = null,
): Drawn {
  const rows = heightOf(company, cols)
  const b: Pixels = {
    w: cols * 2,
    h: rows * 2,
    px: new Array<string | null>(cols * 2 * rows * 2).fill(null),
  }
  const labels: Label[] = []
  const seats: Drawn["seats"] = []
  const links: Drawn["lines"] = []
  if (company.header)
    labels.push({
      x: 0,
      y: 0,
      str: company.header,
      fg: TITLE,
      bold: true,
      max: cols,
    })
  const layout = layoutOf(company, cols)
  for (const { room, x: rx, y: cy, w, h, bands } of layout.rooms) {
    if (room.bare) fill(b, rx * 2, cy * 2, w * 2, h * 2, FLOOR)
    else {
      carpet(b, { x: rx + 1, y: cy + 1, w: w - 2, h: h - 2 })
      // A room where a team just finished: green walls on every other beat, and
      // the title says so, so the pane shows where the work came in.
      const accent = room.isCheering ? (Math.floor(t / 2) % 2 === 0 ? DONE_GREEN : WALL) : undefined
      walls(b, labels, { x: rx, y: cy, w, h }, titleOfRoom(room, room.isCheering === true), room.footer, accent)
    }
    let y = room.bare ? cy : cy + 1
    for (const band of bands) {
      let x = room.bare ? rx : rx + 1 + Math.floor((w - 2 - bandWidth(band)) / 2)
      const row = y + (room.signs?.[band[0]?.index ?? 0] ? 1 : 0)
      if (!room.bare && band === bands[0]) lamp(b, rx, { from: x, row })
      for (const block of band) {
        drawTeam(b, labels, seats, room, block, { x, y, tall: tallest(band) }, t, selected)
        x += block.seats * SEAT_COLS + AISLE
      }
      y += tallest(band) + (room.bare ? 0 : 1)
    }
  }
  if (company.board !== undefined) {
    board(b, labels, layout.bottom, cols, company.board, selected, links)
  }
  return { cols, rows, cells: toCells(b, cols, rows, labels), seats, lines: links }
}

// A row as the drawing sends it: one run per stretch of cells alike in colour.
export function runsOf(line: Cell[]): Cell[] {
  const runs: Cell[] = []
  for (const cell of line) {
    const last = runs[runs.length - 1]
    if (last !== undefined && last.fg === cell.fg && last.bg === cell.bg && last.bold === cell.bold) last.ch += cell.ch
    else runs.push({ ...cell })
  }
  return runs
}

// A Client's tree may serialize to at most 100,000 characters, and a wide office
// with carpet and furniture ran past it and drew nothing. The pane draws the
// office as a stack of Clients, each a band of rows kept well under the bound,
// since a row's runs change from frame to frame as the crabs move.
const SLICE_BUDGET = 60_000
const RUN_COST = 80

export function slicesOf(cells: Cell[][], budget = SLICE_BUDGET): [number, number][] {
  const slices: [number, number][] = []
  let from = 0
  let size = 0
  cells.forEach((line, y) => {
    const row = runsOf(line).reduce((n, run) => n + run.ch.length + RUN_COST, 0)
    if (y > from && size + row > budget) {
      slices.push([from, y])
      from = y
      size = 0
    }
    size += row
  })
  if (cells.length > from) slices.push([from, cells.length])
  return slices
}

// Emoji and CJK take two cells; the second gets an empty string so a row's
// runs still add up to its width.
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/
const cellsOf = (ch: string) => (WIDE.test(ch) ? 2 : 1)

export function width(s: string): number {
  let w = 0
  for (const ch of s) w += cellsOf(ch)
  return w
}

export function fit(s: string, max: number): string {
  if (max <= 0) return ""
  if (width(s) <= max) return s
  let out = ""
  let w = 0
  for (const ch of s) {
    if (w + cellsOf(ch) > max - 1) break
    out += ch
    w += cellsOf(ch)
  }
  return `${out}…`
}

function rgb(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function nearer(c: string, a: string, b: string): string {
  const d = (p: string, q: string) => {
    const [P, Q] = [rgb(p), rgb(q)]
    return (P[0] - Q[0]) ** 2 + (P[1] - Q[1]) ** 2 + (P[2] - Q[2]) ** 2
  }
  return d(c, a) <= d(c, b) ? a : b
}

// Every cell becomes one glyph and at most two colours: a lone colour over the
// terminal's own background, or two with the commoner as background. A third
// colour, which the drawings avoid, takes the nearer of the two.
function toCells(
  b: Pixels,
  cols: number,
  rows: number,
  labels: Label[],
): Cell[][] {
  const cells: Cell[][] = []
  for (let r = 0; r < rows; r++) {
    const line: Cell[] = []
    for (let c = 0; c < cols; c++) {
      const at = (dx: number, dy: number) =>
        b.px[(2 * r + dy) * b.w + 2 * c + dx] ?? null
      const quad = [at(0, 0), at(1, 0), at(0, 1), at(1, 1)]
      const counts = new Map<string | null, number>()
      for (const p of quad) counts.set(p, (counts.get(p) ?? 0) + 1)
      const ranked = [...counts.entries()]
        .sort((a, z) => z[1] - a[1])
        .map(([p]) => p)
      const isCrowded = ranked.length > 2
      const opaque = ranked.filter((p): p is string => p !== null)
      const first = isCrowded ? opaque[0] : ranked[0]
      const second = isCrowded ? opaque[1] : ranked[1]
      let fg: string | undefined
      let bg: string | undefined
      if (first === undefined || first === null) fg = second ?? undefined
      else if (second === undefined || second === null) fg = first
      else [bg, fg] = [first, second]
      const mapped = quad.map((p) => {
        if (!isCrowded || first == null || second == null) return p
        if (p === null) return first
        return p === first || p === second ? p : nearer(p, first, second)
      })
      const mask = mapped.reduce<number>(
        (m, p, i) =>
          fg !== undefined && p === fg ? m | ([8, 4, 2, 1][i] ?? 0) : m,
        0,
      )
      line.push({ ch: GLYPH[mask] ?? " ", fg, bg })
    }
    cells.push(line)
  }
  for (const label of labels) {
    const row = cells[label.y]
    if (row === undefined) continue
    const text = label.ch ?? fit(label.str ?? "", label.max ?? cols)
    let x = label.x
    for (const ch of text) {
      const w = cellsOf(ch)
      if (x + w > cols) break
      const under = row[x]
      const bg =
        label.bg ?? under?.bg ?? (under?.ch === "█" ? under.fg : undefined)
      row[x] = { ch, fg: label.fg, bg, bold: label.bold, isText: true }
      if (w === 2) row[x + 1] = { ch: "", fg: label.fg, bg, isText: true }
      x += w
    }
  }
  return cells
}
