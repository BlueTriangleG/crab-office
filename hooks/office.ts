// The office's model: what one session knows about its own crabs, and how every
// session's snapshot becomes the company the drawing shows. No engine calls
// here, so the tests drive it directly.

import { HQ, LEADER_COLOR, MANAGER_HATS, titleOf } from "./pixels.ts"
import { CHAIRMAN_NAMES, HQ_NAMES, w } from "./words.ts"
import type { BoardLine, Company, Room, SeatData, Speaker } from "./pixels.ts"

export type Status =
  | "thinking"
  | "editing"
  | "reading"
  | "searching"
  | "running"
  | "browsing"
  | "delegating"
  | "approval"
  | "idle"
  | "done"
  | "failed"

export type Crab = {
  id: string
  // 'leader' for the session itself, else the subagent type
  role: string
  model?: string
  color?: string
  title: string
  status: Status
  since: number
  hiredAt?: number
  // When a manager last finished a turn; cleared when the next one starts.
  finishedAt?: number
  tools: string[]
  prompt?: string
  answer?: string
}

// One line on the shared board. Names and colours are kept as they were when
// it was said, so a line outlives the crab who said it.
// What the chairman says on the board, kept in a file of its own so it outlives
// the session it was typed in. `open` waits for whoever is free first.
export type Target = { kind: "all" } | { kind: "open" } | { kind: "team"; name: string }
export type Memo = { id: string; at: number; text: string; to: Target }
export type Claim = { memoId: string; at: number; sessionId: string; who: string }

// A btw: a question to one crab, answered beside its work and never as a turn
// of it. One to a crab of another session goes over as a file, and that session
// answers it.
export type Ask = { id: string; at: number; to: string; crab: string; question: string }
export type Reply = { id: string; at: number; text: string }

export type Note = {
  at: number
  kind: "assign" | "report" | "message" | "memo"
  from: Speaker
  to: Speaker
  text: string
}

export type Snapshot = {
  v: 1
  sessionId: string
  project: string
  startedAt: number
  updatedAt: number
  ended?: boolean
  hired: number
  leader: Crab
  agents: Crab[]
  board?: Note[]
  // The git worktree the session works in, when it is one: its team's name.
  team?: string
  // When each of this session's drawings last reported a frame, by its key.
  drawn?: Record<string, number>
  // The chairman's memos this session has been handed, so none comes twice.
  handled?: string[]
  // When this session last read the board, so its inbox holds only what came
  // after.
  seen?: number
}

export const STALE_MS = 30_000
export const LEAVE_MS = 5 * 60_000
export const DONE_KEEP_MS = 60_000
export const SLEEP_MS = 10 * 60_000
export const MAIL_MS = 3_000
export const CHEER_MS = 15_000
const TEXT_MAX = 500
const TOOLS_KEPT = 5
const BOARD_KEPT = 12
const BOARD_SHOWN = 8

// The crew's colours sit beside Clawd's own at a like lightness, handed out in
// hiring order so one team never repeats.
export const CREW_COLORS = [
  "#6a9bcc",
  "#5fa8a0",
  "#b48ac4",
  "#8da563",
  "#d8b356",
  "#d1788f",
  "#8c9db5",
  "#e0985f",
]
const OUTSIDER = "#8f8b80"

// Where a session sits in the company: a git worktree belongs to its
// repository's department, under the worktree's own name. The `.git` a worktree
// holds is a file, "gitdir: <repo>/.git/worktrees/<name>"; anywhere else the
// folder is the department. Three worktrees of one repository had shown up as
// three departments with names nobody could place.
export function placeOf(root: string, gitFile: string | undefined): { project: string; team?: string } {
  const linked = /gitdir:\s*(.+?)[\\/]\.git[\\/]worktrees[\\/]([^\\/\s]+)/.exec(gitFile ?? "")
  if (linked?.[1] !== undefined && linked[2] !== undefined) return { project: basename(linked[1]), team: linked[2] }
  return { project: basename(root) }
}

export function createSnapshot(
  sessionId: string,
  project: string,
  model: string | undefined,
  now: number,
  team?: string,
): Snapshot {
  return {
    v: 1,
    sessionId,
    project,
    ...(team === undefined ? {} : { team }),
    startedAt: now,
    updatedAt: now,
    hired: 0,
    leader: {
      id: sessionId,
      role: "leader",
      model,
      title: "",
      status: "idle",
      since: now,
      tools: [],
    },
    agents: [],
    board: [],
  }
}

export function clip(text: string, max = TEXT_MAX): string {
  const one = text.replace(/\s+/g, " ").trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

export function basename(path: string): string {
  return (
    path
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() || path
  )
}

function crabOf(s: Snapshot, agentId: string | undefined): Crab | undefined {
  return agentId === undefined
    ? s.leader
    : s.agents.find((a) => a.id === agentId)
}

function colorOf(crab: Crab): string {
  return crab.role === "leader"
    ? LEADER_COLOR
    : (crab.color ?? CREW_COLORS[0] ?? LEADER_COLOR)
}

// A session's own crab is 部长 in the repository's checkout and 组长 in a
// worktree; a subagent goes by its type's title.
function roleOf(crab: Crab, s: Snapshot): string {
  return crab.role === "leader" && s.team !== undefined ? "lead" : crab.role
}

function speakerOf(crab: Crab, s: Snapshot): Speaker {
  return { name: titleOf(roleOf(crab, s)), color: colorOf(crab), id: crab.id }
}

function noted(s: Snapshot, note: Note) {
  s.board = [...(s.board ?? []), note].slice(-BOARD_KEPT)
}

function moved(crab: Crab, status: Status, now: number) {
  if (crab.status === status) return
  crab.status = status
  crab.since = now
}

// What the person asked, as a turn's text carries it: a slash command arrives
// wrapped in tags with its output beside it, and reminders ride along. The
// first live run named a manager "<local-command-stdout>Goal set: …".
export function promptOf(text: string): string {
  const name = /<command-name>([\s\S]*?)<\/command-name>/.exec(text)?.[1]
  const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(text)?.[1] ?? ""
  const typed = text
    .replace(
      /<(system-reminder|local-command-stdout|local-command-stderr|local-command-caveat|command-name|command-message|command-args|bash-stdout|bash-stderr)>[\s\S]*?<\/\1>/g,
      " ",
    )
    .replace(/<bash-input>([\s\S]*?)<\/bash-input>/g, "! $1")
    .replace(/<[^>]+>/g, " ")
  const command = name === undefined ? "" : `${name.trim()} ${args.trim()}`
  return clip(`${command} ${typed}`)
}

export function turnStarted(
  s: Snapshot,
  agentId: string | undefined,
  text: string,
  now: number,
) {
  const crab = crabOf(s, agentId)
  if (crab === undefined) return
  if (agentId === undefined) {
    const prompt = promptOf(text)
    crab.title = clip(prompt, 80)
    crab.prompt = prompt
    delete crab.finishedAt
  }
  moved(crab, "thinking", now)
}

export function spawned(
  s: Snapshot,
  a: {
    agentId: string
    parentId?: string
    type: string
    isFork: boolean
    model?: string
    description: string
    prompt: string
  },
  now: number,
) {
  const crab: Crab = {
    id: a.agentId,
    role: a.isFork ? "fork" : a.type || "general-purpose",
    model: a.model,
    color: CREW_COLORS[s.hired % CREW_COLORS.length],
    title: clip(a.description, 80),
    status: "thinking",
    since: now,
    hiredAt: now,
    tools: [],
    prompt: clip(a.prompt),
  }
  s.agents.push(crab)
  s.hired += 1
  const boss = crabOf(s, a.parentId) ?? s.leader
  noted(s, {
    at: now,
    kind: "assign",
    from: speakerOf(boss, s),
    to: speakerOf(crab, s),
    text: clip(a.description, 120),
  })
}

// A SendMessage from any loop of this session. The recipient is one of this
// session's crabs by id, or someone outside it, named as the sender spelled it.
export function messageSent(
  s: Snapshot,
  agentId: string | undefined,
  to: string,
  text: string,
  now: number,
) {
  const sender = crabOf(s, agentId) ?? s.leader
  const target = [s.leader, ...s.agents].find((c) => c.id === to)
  const recipient =
    target === undefined ? { name: to, color: OUTSIDER } : speakerOf(target, s)
  noted(s, {
    at: now,
    kind: "message",
    from: speakerOf(sender, s),
    to: recipient,
    text: clip(text, 120),
  })
}

const TOOL_STATUS: Record<string, Status> = {
  Edit: "editing",
  Write: "editing",
  MultiEdit: "editing",
  NotebookEdit: "editing",
  Read: "reading",
  Grep: "searching",
  Glob: "searching",
  LS: "searching",
  ToolSearch: "searching",
  Bash: "running",
  BashOutput: "running",
  Monitor: "running",
  WebFetch: "browsing",
  WebSearch: "browsing",
  Agent: "delegating",
  Task: "delegating",
  // Handing a report back, or a message on, reads as passing work along.
  SubagentHandback: "delegating",
  SendMessage: "delegating",
}

export function statusOfTool(tool: string): Status {
  return (
    TOOL_STATUS[tool] ?? (tool.startsWith("mcp__") ? "browsing" : "running")
  )
}

export function toolLabel(
  tool: string,
  input: Record<string, unknown>,
): string {
  const pick = (key: string) =>
    typeof input[key] === "string" ? (input[key] as string) : undefined
  const path = pick("file_path") ?? pick("notebook_path")
  const detail =
    path !== undefined
      ? basename(path)
      : (pick("command") ??
        pick("pattern") ??
        pick("description") ??
        pick("url") ??
        pick("query"))
  return detail === undefined ? tool : `${tool} ${clip(detail, 40)}`
}

export function toolStarted(
  s: Snapshot,
  agentId: string | undefined,
  tool: string,
  label: string,
  now: number,
) {
  const crab = crabOf(s, agentId)
  if (crab === undefined) return
  crab.tools = [...crab.tools, label].slice(-TOOLS_KEPT)
  moved(crab, statusOfTool(tool), now)
}

// ponytail: an approved call keeps showing ✋ until it finishes, because no event
// marks the moment the person answers the permission prompt.
export function toolAsked(
  s: Snapshot,
  agentId: string | undefined,
  now: number,
) {
  const crab = crabOf(s, agentId)
  if (crab !== undefined) moved(crab, "approval", now)
}

export function toolFinished(
  s: Snapshot,
  agentId: string | undefined,
  now: number,
) {
  const crab = crabOf(s, agentId)
  if (
    crab === undefined ||
    crab.status === "idle" ||
    crab.status === "done" ||
    crab.status === "failed"
  )
    return
  moved(crab, "thinking", now)
}

export function turnFinished(
  s: Snapshot,
  agentId: string | undefined,
  t: { isAnswer: boolean; answer: string; model?: string },
  now: number,
) {
  const crab = crabOf(s, agentId)
  if (crab === undefined) return
  if (t.model) crab.model = t.model
  if (agentId === undefined) {
    moved(crab, "idle", now)
    crab.finishedAt = now
    return
  }
  crab.answer = clip(t.answer)
  moved(crab, t.isAnswer ? "done" : "failed", now)
  const text = t.isAnswer ? clip(t.answer, 120) : w().unfinished
  noted(s, {
    at: now,
    kind: "report",
    from: speakerOf(crab, s),
    to: speakerOf(s.leader, s),
    text,
  })
}

export function pruned(s: Snapshot, now: number): boolean {
  const before = s.agents.length
  s.agents = s.agents.filter(
    (a) =>
      (a.status !== "done" && a.status !== "failed") ||
      now - a.since < DONE_KEEP_MS,
  )
  return s.agents.length !== before
}

export function parseSnapshot(text: string): Snapshot | undefined {
  try {
    const s = JSON.parse(text) as Partial<Snapshot>
    const isSnapshot =
      s.v === 1 &&
      typeof s.sessionId === "string" &&
      s.leader !== undefined &&
      Array.isArray(s.agents)
    return isSnapshot ? (s as Snapshot) : undefined
  } catch {
    return undefined
  }
}

export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 3600)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
  return `${Math.floor(s / 3600)}h${String(Math.floor(s / 60) % 60).padStart(2, "0")}`
}

function clockOf(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function isGoneOf(s: Snapshot, now: number): boolean {
  return s.ended === true || now - s.updatedAt > STALE_MS
}

function lookOf(crab: Crab, now: number, isGone: boolean): string {
  if (isGone) return "gone"
  if (crab.status === "idle" && now - crab.since > SLEEP_MS) return "asleep"
  return crab.status
}

// An envelope rides the org chart for a few seconds after work is handed down
// and after it is handed back.
function mailOf(crab: Crab, now: number): SeatData["mail"] {
  if (crab.role === "leader") return undefined
  if (crab.hiredAt !== undefined && now - crab.hiredAt < MAIL_MS) return "down"
  if (
    (crab.status === "done" || crab.status === "failed") &&
    now - crab.since < MAIL_MS
  )
    return "up"
  return undefined
}

// A manager that has just finished a turn cheers for a while, then keeps a
// mark until the next turn starts: done, and waiting for you.
function finishOf(crab: Crab, now: number, isGone: boolean): SeatData["finish"] {
  if (isGone || crab.finishedAt === undefined || crab.status !== "idle") return undefined
  return now - crab.finishedAt < CHEER_MS ? "cheer" : "done"
}

export function seatOf(crab: Crab, now: number, isGone: boolean): SeatData {
  const mail = isGone ? undefined : mailOf(crab, now)
  const finish = finishOf(crab, now, isGone)
  return {
    id: crab.id,
    role: crab.role,
    task: crab.title,
    look: lookOf(crab, now, isGone),
    color: colorOf(crab),
    ...(mail === undefined ? {} : { mail }),
    ...(finish === undefined ? {} : { finish }),
  }
}

// A manager with no task yet goes by its worktree's name, so two idle teams of
// one department can be told apart.
function teamOf(s: Snapshot, now: number, hat: string | undefined): SeatData[] {
  const isGone = isGoneOf(s, now)
  const [leader, ...crew] = [s.leader, ...s.agents].map((c) => seatOf(c, now, isGone))
  if (leader === undefined) return crew
  const task = leader.task || s.team || ""
  if (hat === CHIEF) return [{ ...leader, role: CHIEF, task }, ...crew]
  return [{ ...leader, role: roleOf(s.leader, s), task, ...(hat ? { hat } : {}) }, ...crew]
}

const CHIEF = "chief"

function bySeniority(a: Snapshot, b: Snapshot): number {
  return a.startedAt - b.startedAt || a.sessionId.localeCompare(b.sessionId)
}

// One crown a department: its 大部长, the longest-serving session in the
// repository's own checkout, or in a worktree where none is. One crown for the
// whole company left every other repository headless. Every other manager gets
// a hat of its own, handed out by seniority, so a newcomer never takes an old
// hand's hat and no two match while there are hats to go round.
export function chiefsOf(snaps: Snapshot[], now: number): Set<string> {
  const chiefs = new Set<string>()
  const senior = snaps.filter((s) => !isGoneOf(s, now)).sort(bySeniority)
  for (const project of new Set(senior.map((s) => s.project))) {
    const staff = senior.filter((s) => s.project === project)
    const chief = staff.find((s) => s.team === undefined) ?? staff[0]
    if (chief !== undefined) chiefs.add(chief.sessionId)
  }
  return chiefs
}

export function hatsOf(snaps: Snapshot[], now: number): Map<string, string> {
  const chiefs = chiefsOf(snaps, now)
  const hats = new Map<string, string>()
  ;[...snaps]
    .sort(bySeniority)
    .filter((s) => !chiefs.has(s.sessionId))
    .forEach((s, i) => {
      const hat = MANAGER_HATS[i % MANAGER_HATS.length]
      if (hat !== undefined) hats.set(s.sessionId, hat)
    })
  for (const id of chiefs) hats.set(id, CHIEF)
  return hats
}

const RESTING = new Set([
  "idle",
  "approval",
  "done",
  "failed",
  "asleep",
  "gone",
])

export function footerOf(seats: SeatData[]): string {
  const working = seats.filter((s) => !RESTING.has(s.look)).length
  const waiting = seats.filter(
    (s) => s.look === "approval" || s.look === "idle",
  ).length
  const gone = seats.filter((s) => s.look === "gone").length
  return w().footer(working, waiting, gone)
}

// The company: a department per project, this session's first; in each, a team
// per session, this session's first, then by who started earliest. Under them,
// the shared board: the latest things anyone said to anyone, from every session.
export function companyOf(
  snaps: Snapshot[],
  mine: string,
  now: number,
  desk: { memos: Memo[]; claims: Claim[] } = { memos: [], claims: [] },
): Company {
  const present = snaps.filter(
    (s) => now - s.updatedAt < LEAVE_MS || s.sessionId === mine,
  )
  const isMine = (project: string) =>
    present.some((s) => s.sessionId === mine && s.project === project)
  const projects = [...new Set(present.map((s) => s.project))].sort((a, b) =>
    isMine(a) === isMine(b) ? a.localeCompare(b) : isMine(a) ? -1 : 1,
  )
  const hats = hatsOf(present, now)
  const rooms: Room[] = projects.map((project) => {
    // The 大部长's team first, which the drawing seats alone on the top row;
    // the rest by seniority.
    const sessions = present
      .filter((s) => s.project === project)
      .sort((a, b) => Number(hats.get(b.sessionId) === CHIEF) - Number(hats.get(a.sessionId) === CHIEF) || bySeniority(a, b))
    const here = sessions.findIndex((s) => s.sessionId === mine)
    const teams = sessions.map((s) => teamOf(s, now, hats.get(s.sessionId)))
    const isCheering = teams.some((team) => team[0]?.finish === "cheer")
    // Signs only where a department has more than one team to tell apart.
    const signs = sessions.length > 1 ? sessions.map((s) => (s.team ? w().teamSign(s.team) : w().hq)) : undefined
    return {
      title: w().dept(project),
      footer: footerOf(teams.flat()),
      teams,
      ...(signs ? { signs } : {}),
      ...(isCheering ? { isCheering } : {}),
      ...(here >= 0 ? { here } : {}),
    }
  })
  const onDuty = rooms
    .flatMap((r) => r.teams.flat())
    .filter((s) => s.look !== "gone").length
  const memoNotes: Note[] = desk.memos.map((m) => {
    const takers = desk.claims.filter((c) => c.memoId === m.id).map((c) => c.who)
    return {
      at: m.at,
      kind: "memo",
      from: chairman(),
      to: { name: addresseeOf(m.to), color: NAMEPLATE_INK },
      text: takers.length === 0 ? m.text : w().taken(m.text, takers),
    }
  })
  const chiefs = chiefsOf(present, now)
  const board: BoardLine[] = [...present.flatMap((s) => (s.board ?? []).map((n) => shownNote(n, s, chiefs))), ...memoNotes]
    .sort((a, b) => a.at - b.at)
    .slice(-BOARD_SHOWN)
    .map((n) => ({
      time: clockOf(n.at),
      kind: n.kind,
      from: n.from,
      to: n.to,
      text: n.text,
    }))
  return { header: w().header(onDuty), rooms, board, lang: w().lang }
}

// The strip above the prompt: this session's team on one row of desks.
export function bandOf(s: Snapshot, snaps: Snapshot[], now: number): Company {
  return {
    rooms: [
      {
        title: "",
        footer: "",
        bare: true,
        flat: true,
        teams: [teamOf(s, now, hatsOf(snaps, now).get(s.sessionId))],
      },
    ],
    lang: w().lang,
  }
}

export function findCrab(
  snaps: Snapshot[],
  id: string,
): { crab: Crab; snap: Snapshot } | undefined {
  for (const snap of snaps) {
    const crab =
      snap.leader.id === id ? snap.leader : snap.agents.find((a) => a.id === id)
    if (crab !== undefined) return { crab, snap }
  }
  return undefined
}

function statusOf(look: string): string {
  return w().status[look] ?? look
}

export function detailLines(crab: Crab, snap: Snapshot, now: number): string[] {
  const look = lookOf(crab, now, isGoneOf(snap, now))
  const state = `${statusOf(look)} ${elapsed(now - crab.since)}`
  const model = crab.model ?? w().modelUnknown
  const tools = crab.tools.length > 0 ? crab.tools.join("  ") : w().noTools
  const head = `${titleOf(roleOf(crab, snap))} · ${model} · ${state}`
  if (crab.role === "leader") {
    return [`${head} · ${whoOf(snap)}`, w().task(crab.prompt ?? w().notStarted), `⚙ ${tools}`]
  }
  return [
    `${head} · ${crab.role}`,
    w().given(crab.prompt ?? ""),
    `⚙ ${tools}`,
    w().handedBack(crab.answer ?? w().stillWorking),
  ]
}

// The chairman's memos: who they are for, who takes them, and what a session is
// handed when one reaches it.

const chairman = (): Speaker => ({ name: w().chairman, color: "#e8c468" })
const NAMEPLATE_INK = "#e6e0d6"
export const MEMO_TTL_MS = 24 * 60 * 60_000
const EVERYONE = new Set(["全体", "所有人", "大家", "all", "everyone"])

// "/office say @全体 …", "/office say @<worktree or 本部 or project> …", or
// no @ at all: a memo for whoever is free first.
export function parseSay(args: string, id: string, now: number): Memo | undefined {
  const text = args.trim()
  // "@name 组 text" as the board spells a team, "@name组 text", or "@name text";
  // 本部 keeps its own name.
  const at = /^@(\S+)(?:\s+(?:组|部|team|dept))?\s+([\s\S]+)$/.exec(text)
  if (at?.[1] !== undefined && at[2] !== undefined) {
    const name = HQ_NAMES.has(at[1].toLowerCase()) ? HQ : at[1].replace(/(组|部)$/, "")
    const to: Target = EVERYONE.has(name.toLowerCase()) ? { kind: "all" } : { kind: "team", name }
    return { id, at: now, text: clip(at[2]), to }
  }
  return text === "" ? undefined : { id, at: now, text: clip(text), to: { kind: "open" } }
}

export function addresseeOf(to: Target): string {
  if (to.kind === "all") return w().everyone
  if (to.kind === "open") return w().open
  return to.name === HQ ? w().hq : w().teamSign(to.name)
}

export function teamNameOf(s: Snapshot): string {
  return s.team ?? HQ
}

export function whoOf(s: Snapshot): string {
  return w().who(s.project, s.team ?? w().hq)
}

// A team memo names a worktree, 本部, or a whole department by its project.
export function isFor(to: Target, s: Snapshot): boolean {
  if (to.kind !== "team") return to.kind === "all"
  return to.name === teamNameOf(s) || to.name === s.project
}

// Who a colleague's message names, the way a memo names them: everyone, a team
// or a department. The chairman, or no name, is nobody's inbox but the board.
export function targetOf(to: string): Target | undefined {
  const name = to.trim().replace(/^@/, "")
  if (name === "" || CHAIRMAN_NAMES.has(name)) return undefined
  return parseSay(`@${name} .`, "", 0)?.to
}

export function recipientsOf(to: Target, me: Snapshot, snaps: Snapshot[], now: number): Snapshot[] {
  return snaps.filter((s) => s.sessionId !== me.sessionId && !isGoneOf(s, now) && isFor(to, s))
}

// What colleagues in other sessions wrote to this one since it last read the
// board. A message never wakes its reader: it waits here, so two sessions
// cannot talk each other into turns without end.
export function inboxOf(me: Snapshot, snaps: Snapshot[], now: number): string[] {
  const chiefs = chiefsOf(snaps, now)
  return snaps
    .filter((s) => s.sessionId !== me.sessionId)
    .flatMap((s) =>
      (s.board ?? [])
        .filter((n) => {
          const to = n.kind === "message" ? targetOf(n.to.name) : undefined
          return to !== undefined && n.at > (me.seen ?? me.startedAt) && isFor(to, me)
        })
        .map((n) => ({ n: shownNote(n, s, chiefs), s })),
    )
    .sort((a, b) => a.n.at - b.n.at)
    .map(({ n, s }) => w().inboxLine(clockOf(n.at), whoOf(s), n.from.name, n.to.name, n.text))
}

// The board as a session reads it: the latest lines from every session, each
// saying whose it is, since a title alone (部长) names one in every session.
export function boardOf(snaps: Snapshot[], now: number, limit = BOARD_SHOWN): string[] {
  const chiefs = chiefsOf(snaps, now)
  return snaps
    .flatMap((s) => (s.board ?? []).map((n) => ({ n: shownNote(n, s, chiefs), s })))
    .sort((a, b) => a.n.at - b.n.at)
    .slice(-limit)
    .map(({ n, s }) => w().boardLine(clockOf(n.at), whoOf(s), n.from.name, n.to.name, n.text))
}

// Free is finished: the manager waiting and none of its crew still at work, so
// a memo never lands on a team in the middle of something.
const AT_REST = new Set(["idle", "done", "failed"])

function isFree(s: Snapshot, now: number): boolean {
  return !isGoneOf(s, now) && s.leader.status === "idle" && s.agents.every((a) => AT_REST.has(a.status))
}

function isHolding(s: Snapshot, memo: Memo, now: number): boolean {
  return (s.handled ?? []).includes(memo.id) && !isGoneOf(s, now) && !isFree(s, now)
}

// Who looks at a memo for whoever is free: of the free sessions that have not
// passed on it, the first by id. Every session works the same answer out from
// the same files, so one goes, and if it passes, the next.
export function takerOf(memo: Memo, snaps: Snapshot[], now: number): string | undefined {
  return snaps
    .filter((s) => isFree(s, now) && !(s.handled ?? []).includes(memo.id))
    .map((s) => s.sessionId)
    .sort()[0]
}

// The one memo this session should be handed now, if any: free, not handed it
// before, and either named in it, or everyone's, or first in line for it.
export function memoFor(me: Snapshot, snaps: Snapshot[], memos: Memo[], claims: Claim[], now: number): Memo | undefined {
  if (!isFree(me, now)) return undefined
  const handled = new Set(me.handled ?? [])
  return memos
    .filter((m) => now - m.at < MEMO_TTL_MS && !handled.has(m.id))
    .sort((a, b) => a.at - b.at)
    .find((m) => {
      // Still busy with it is still holding it: the claim lands a turn after the
      // handover, and in that gap the next in line, then the next, took it too.
      if (m.to.kind === "open")
        return (
          !claims.some((c) => c.memoId === m.id) &&
          !snaps.some((s) => isHolding(s, m, now)) &&
          takerOf(m, snaps, now) === me.sessionId
        )
      // Named and everyone's memos reach the sessions that were there to hear them.
      return isFor(m.to, me) && m.at >= me.startedAt - 60_000
    })
}

// Who `/office say @` can name, for the prompt box's typeahead: everyone, a
// department, or a worktree's team. A checkout's own session has no name of its
// own to give, since every department has a 本部; its department's name reaches it.
export function addresseesOf(snaps: Snapshot[], now: number, typed: string): { text: string; description: string }[] {
  const here = snaps.filter((s) => !isGoneOf(s, now))
  const projects = [...new Set(here.map((s) => s.project))].sort()
  const teams = here.filter((s) => s.team !== undefined).sort((a, b) => whoOf(a).localeCompare(whoOf(b)))
  const rows = [
    { name: w().everyone, description: w().everyoneDesc(here.length) },
    ...projects.map((p) => ({ name: p, description: w().deptDesc(p, here.filter((s) => s.project === p).length) })),
    ...teams.map((s) => ({
      name: s.team ?? "",
      description: w().teamDesc(whoOf(s), statusOf(lookOf(s.leader, now, false))),
    })),
  ]
  const query = typed.toLowerCase()
  return rows
    .filter((r) => r.name.toLowerCase().includes(query))
    .map((r) => ({ text: `@${r.name} `, description: r.description }))
}

// What the session's own thread is asked, through a fork of it: about itself, or
// about a subagent of its whose own conversation can no longer be read.
export function btwOf(crab: Crab, question: string): string {
  if (crab.role === "leader") return `${w().btw}\n${question}`
  const tools = crab.tools.join(", ") || w().noTools
  const back = crab.answer ? clip(crab.answer, 200) : ""
  return `${w().btw}\n${w().btwFor(titleOf(crab.role), crab.title, tools, back, question)}`
}

type Row = {
  role: string
  text: string
  toolUses: readonly { tool: string; input: Record<string, unknown>; text?: string }[]
}

// A subagent asked about itself: its own conversation so far, newest kept when
// it runs long, read back to the model as its record.
export function subagentBtwOf(crab: Crab, rows: readonly Row[], question: string, max = 24_000): { system: string; prompt: string } {
  const lines = rows.flatMap((m) => [
    ...(m.text ? [`${m.role === "user" ? w().recordGiven : w().recordMe}${m.text}`] : []),
    ...m.toolUses.map((u) => `[${u.tool}] ${clip(JSON.stringify(u.input), 200)}${u.text ? ` → ${clip(u.text, 300)}` : ""}`),
  ])
  const record = lines.join("\n")
  return {
    system: `${w().subagent(titleOf(crab.role), crab.title)} ${w().btw}`,
    prompt: `${record.length > max ? `…${record.slice(-max)}` : record}\n\n${w().asks(question)}`,
  }
}

// A board line as shown now: its crabs titled as the drawing titles them, the
// 大部长 included, in the words the office speaks now. A note keeps the names it
// was written with, before anyone knew who would be 大部长.
function shownNote(n: Note, s: Snapshot, chiefs: Set<string>): Note {
  const shown = (sp: Speaker): Speaker => {
    if (sp.id === s.sessionId) return { ...sp, name: managerTitleOf(s, chiefs) }
    const crab = s.agents.find((a) => a.id === sp.id)
    if (crab !== undefined) return { ...sp, name: titleOf(crab.role) }
    return CHAIRMAN_NAMES.has(sp.name) ? { ...sp, name: w().chairman } : sp
  }
  return { ...n, from: shown(n.from), to: shown(n.to) }
}

// A session's title as the drawing gives it: its department's 大部长 is one.
function managerTitleOf(s: Snapshot, chiefs: Set<string>): string {
  return titleOf(chiefs.has(s.sessionId) ? CHIEF : roleOf(s.leader, s))
}

export function rosterOf(snaps: Snapshot[], me: Snapshot, now: number): string[] {
  const chiefs = chiefsOf(snaps, now)
  return snaps
    .filter((s) => !isGoneOf(s, now))
    .map((s) => {
      const title = managerTitleOf(s, chiefs)
      const look = statusOf(lookOf(s.leader, now, false))
      const task = s.leader.title ? clip(s.leader.title, 40) : ""
      return w().roster(whoOf(s), title, s.sessionId === me.sessionId, look, task, s.agents.length)
    })
}

// What a session is handed: the memo, who it is, its colleagues, and how to
// take it on or pass, through the office_board tool.
export function handoverOf(memo: Memo, me: Snapshot, snaps: Snapshot[], now: number): string {
  const how = w().handover[memo.to.kind === "team" ? "team" : memo.to.kind === "all" ? "all" : "open"]
  return [
    w().handover.head(addresseeOf(memo.to), memo.id),
    memo.text,
    "",
    w().handover.youAre(managerTitleOf(me, chiefsOf(snaps, now)), whoOf(me)),
    ...rosterOf(snaps, me, now),
    "",
    how,
  ].join("\n")
}
