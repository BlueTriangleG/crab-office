import type { Job } from "./jobs.ts"
import { LEAVE_MS, chiefsOf, isGoneOf, peerOf, rosterOf, teamNameOf, whoOf } from "./office.ts"
import type { Note, Snapshot } from "./office.ts"
import { LEADER_COLOR, titleOf } from "./pixels.ts"
import type { Speaker } from "./pixels.ts"
import { HQ_NAMES, w } from "./words.ts"

// Who runs the office: the CEO the chairman appointed, and each repository's
// 部长 by appointment. Each session writes only its own records, so two
// sessions where the chairman clicked never write one file; every session works
// the same answer out of all of them, the latest record standing.
export type Appointment = {
  kind: "ceo" | "head"
  // A head's repository, as the board names it (the department).
  project?: string
  // null revokes.
  sessionId: string | null
  at: number
  by: "chairman" | "ceo"
}

// `heads` holds appointed heads alone; a repository without one is headed by
// its longest-serving session (chiefsOf).
export type Org = { ceo?: string; heads: Record<string, string> }

export const NO_ORG: Org = { heads: {} }

export type Rank = "ceo" | "head" | "staff"

function latest(records: Appointment[]): Appointment | undefined {
  return records.reduce<Appointment | undefined>((a, r) => (a === undefined || r.at > a.at ? r : a), undefined)
}

// An appointment lapses once its session has left the company, as the drawing
// lets it go; a head never is the CEO, and the chairman's pick of one stands
// over the CEO's until the chairman revokes it.
export function orgOf(records: Appointment[], snaps: Snapshot[], now: number): Org {
  const present = new Set(snaps.filter((s) => now - s.updatedAt < LEAVE_MS).map((s) => s.sessionId))
  const named = (r: Appointment | undefined) =>
    r?.sessionId !== null && r?.sessionId !== undefined && present.has(r.sessionId) ? r.sessionId : undefined
  const ceo = named(latest(records.filter((r) => r.kind === "ceo")))
  const heads: Record<string, string> = {}
  const projects = new Set(records.flatMap((r) => (r.kind === "head" && r.project !== undefined ? [r.project] : [])))
  for (const project of projects) {
    const own = records.filter((r) => r.kind === "head" && r.project === project)
    const chairman = latest(own.filter((r) => r.by === "chairman"))
    const ceoPick = latest(own.filter((r) => r.by === "ceo"))
    // The chairman's revoke clears every pick made before it, the CEO's too; a
    // CEO's pick made after it stands.
    const picks =
      chairman?.sessionId === null ? [ceoPick !== undefined && ceoPick.at > chairman.at ? ceoPick : undefined] : [chairman, ceoPick]
    const id = picks.map(named).find((x) => x !== undefined && x !== ceo)
    if (id !== undefined) heads[project] = id
  }
  return { ...(ceo === undefined ? {} : { ceo }), heads }
}

// What a writer keeps of its own records: the latest of each kind, repository
// and appointer, all orgOf ever reads. Keeping the last twenty of any kind let
// twenty head appointments push out the CEO's, and an older CEO come back.
export function prunedRecords(records: Appointment[]): Appointment[] {
  const latestOf = new Map<string, Appointment>()
  for (const r of records) {
    const key = `${r.kind}:${r.project ?? ""}:${r.by}`
    const held = latestOf.get(key)
    if (held === undefined || r.at >= held.at) latestOf.set(key, r)
  }
  return [...latestOf.values()]
}

// A session as a reply names it: its place, and the SendMessage name that
// tells it apart, since one checkout holds many sessions of one place.
export function labelOf(s: Snapshot, peers: unknown[], titles: Record<string, string> = {}): string {
  return w().named(whoOf(s), peerOf(peers, s.sessionId)?.name, titles[s.sessionId])
}

// A session's job title, kept as duties are (`titles/<writer>.json`, the latest
// word on a session standing): one each, so a name that moves with its process
// has something fixed to stand behind.
export const titlesOf = (files: Record<string, Duty>[]): Record<string, string> => dutiesOf(files)

const TITLE_MAX = 24

// Why a job title cannot be given, if it cannot: one word, the CEO's reserved,
// and no session at work holding it or going by it as its real name. Nothing is
// numbered to make it fit: a clash is refused.
export function titleRefusal(
  title: string,
  holder: string,
  titles: Record<string, string>,
  snaps: Snapshot[],
  peers: unknown[],
  now: number,
): string | undefined {
  const t = title.trim()
  if (t === "" || t.length > TITLE_MAX || /\s/.test(t)) return w().tool.badTitle(TITLE_MAX)
  if (t.toLowerCase() === "ceo") return w().tool.reservedTitle
  const peer = peerOf(peers, t)
  if (peer !== undefined && peer.sessionId !== holder) return w().tool.titleIsName(t)
  const present = new Set(snaps.filter((s) => now - s.updatedAt < LEAVE_MS).map((s) => s.sessionId))
  const taken = Object.entries(titles).find(([id, x]) => id !== holder && present.has(id) && x.toLowerCase() === t.toLowerCase())
  if (taken === undefined) return undefined
  const s = snaps.find((x) => x.sessionId === taken[0])
  return w().tool.titleTaken(t, s === undefined ? taken[0] : labelOf(s, peers))
}

// Where a SendMessage addressed to a job title, or to CEO, goes now: the name
// its session goes by at this moment. A real name, socket or id is the
// engine's and passes untouched; a title nobody at work holds, or two do, is
// refused rather than guessed.
export function addressOf(
  to: string,
  titles: Record<string, string>,
  org: Org,
  snaps: Snapshot[],
  peers: unknown[],
  now: number,
): { to?: string; refusal?: string } | undefined {
  const name = to.trim()
  if (peerOf(peers, name) !== undefined) return undefined
  const isCeo = name.toLowerCase() === "ceo"
  const held = isCeo
    ? org.ceo === undefined
      ? []
      : [org.ceo]
    : Object.entries(titles)
        .filter(([, x]) => x.toLowerCase() === name.toLowerCase())
        .map(([id]) => id)
  if (held.length === 0) return isCeo ? { refusal: w().tool.noCeoAddress } : undefined
  const here = held.filter((id) => snaps.some((s) => s.sessionId === id && !isGoneOf(s, now)))
  if (here.length > 1) return { refusal: w().tool.titleShared(name) }
  const [id] = here
  const peer = id === undefined ? undefined : peerOf(peers, id)
  const address = peer?.name ?? (peer?.messagingSocketPath === undefined ? undefined : `uds:${peer.messagingSocketPath}`)
  return address === undefined ? { refusal: w().tool.titleAway(name) } : { to: address }
}

export function rankOf(sessionId: string, org: Org, chiefs: Set<string>): Rank {
  if (org.ceo === sessionId) return "ceo"
  return chiefs.has(sessionId) ? "head" : "staff"
}

// "/office ceo @<who>", "/office ceo off", "/office head @<who>", or
// "/office head off [@<who or repository>]" (no name: this session's repository).
export function parseAppoint(args: string): { kind: "ceo" | "head"; name: string | null; isOff: boolean } | undefined {
  const m = /^(ceo|head)(?:\s+(off))?(?:\s+(.+))?$/i.exec(args.trim())
  const kind = m?.[1]?.toLowerCase()
  if (kind !== "ceo" && kind !== "head") return undefined
  const isOff = m?.[2] !== undefined
  const name = m?.[3]?.trim().replace(/^@/, "") || null
  if (!isOff && name === null) return undefined
  return { kind, name, isOff }
}

// The one session a name means: a SendMessage name or socket, a session as the
// board names it (web-app 部 · docs), or a team. A name that fits two means
// neither, and `many` says which it fitted.
export function sessionNamed(
  to: string,
  snaps: Snapshot[],
  peers: unknown[],
  now: number,
  titles: Record<string, string> = {},
): { one?: Snapshot; many: Snapshot[] } {
  const name = to.trim().replace(/^@/, "").replace(/(\s*组|\s+team)$/i, "")
  const here = snaps.filter((s) => !isGoneOf(s, now))
  const peer = peerOf(peers, name)
  const isHq = HQ_NAMES.has(name.toLowerCase())
  const levels = [
    here.filter((s) => s.sessionId === peer?.sessionId),
    here.filter((s) => titles[s.sessionId]?.toLowerCase() === name.toLowerCase()),
    here.filter((s) => whoOf(s) === name),
    here.filter((s) => teamNameOf(s) === name || (isHq && s.team === undefined)),
  ]
  const many = levels.find((level) => level.length > 0) ?? []
  const [only] = many
  return many.length === 1 && only !== undefined ? { one: only, many } : { many }
}

// An appointment or its revocation as a line on the writer's own board: the
// session it is about is its other end, so the line names it and its crab has
// the ✉, wherever the chairman clicked.
export function appointedNote(by: Speaker, target: Snapshot, kind: "ceo" | "head", isRevoked: boolean, now: number): Note {
  return {
    at: now,
    kind: "message",
    from: by,
    to: { name: whoOf(target), color: LEADER_COLOR, id: target.sessionId },
    text: w().appointedLine(titleOf(kind === "ceo" ? "ceo" : "chief"), isRevoked),
  }
}

// What a session is responsible for, as the CEO or its repository's head wrote
// it: each writer keeps its own file (`duties/<sessionId>.json`), the latest
// word on a session standing.
export type Duty = { text: string; at: number; by: string }

export function dutiesOf(files: Record<string, Duty>[]): Record<string, string> {
  const latest: Record<string, Duty> = {}
  for (const file of files)
    for (const [id, duty] of Object.entries(file)) {
      const held = latest[id]
      if (held === undefined || duty.at > held.at) latest[id] = duty
    }
  return Object.fromEntries(Object.entries(latest).map(([id, duty]) => [id, duty.text]))
}

// The CEO's list of who is at work: the roster, and for each session the name
// SendMessage reaches it by, its duty and the jobs it holds open.
export function staffOf(
  snaps: Snapshot[],
  me: Snapshot,
  org: Org,
  duties: Record<string, string>,
  jobs: Job[],
  peers: unknown[],
  now: number,
  titles: Record<string, string> = {},
): string[] {
  const open = (id: string) =>
    jobs.filter((j) => j.to === id && (j.status === "assigned" || j.status === "rejected" || j.status === "reported")).map((j) => j.id)
  return rosterOf(snaps, me, now, org, (s) =>
    w().staffMore(peerOf(peers, s.sessionId)?.name, duties[s.sessionId], open(s.sessionId), titles[s.sessionId]),
  )
}

// What each session is told it is, in its system prompt: who holds which post
// and nothing that moves (no status, no time), so the text, and the prompt's
// cache, hold until an appointment changes. With no CEO nothing is said.
export function roleSectionOf(
  rank: Rank,
  me: Snapshot,
  snaps: Snapshot[],
  org: Org,
  peers: unknown[],
  now: number,
  titles: Record<string, string> = {},
): string | undefined {
  const ceo = snaps.find((s) => s.sessionId === org.ceo)
  if (ceo === undefined) return undefined
  const post = w().titleHelp(titles[me.sessionId])
  if (rank === "ceo") return `${w().roleCeo}\n${post}`
  if (rank === "head") return `${w().roleHead(me.project, labelOf(ceo, peers, titles))}\n${post}`
  const chiefs = chiefsOf(snaps, now, org)
  const head = snaps.find((s) => chiefs.has(s.sessionId) && s.project === me.project)
  return `${w().roleStaff(labelOf(ceo, peers, titles), head === undefined ? undefined : labelOf(head, peers, titles))}\n${post}`
}

// What a session is handed when the chairman makes it CEO: what a CEO does, the
// sessions at work, and the reports that came in while there was no CEO. The
// instructions come whole here as well as in the system prompt, since a plugin
// ahead of this one may pass prompt.compose on without it (one did, live).
export function ceoHandoverOf(
  me: Snapshot,
  snaps: Snapshot[],
  org: Org,
  jobs: Job[],
  duties: Record<string, string>,
  peers: unknown[],
  now: number,
): string {
  const waiting = jobs.filter((j) => j.status === "reported")
  const whoIs = (id: string) => {
    const s = snaps.find((x) => x.sessionId === id)
    return s === undefined ? id : whoOf(s)
  }
  return [
    w().ceoHandoverHead,
    w().roleCeo,
    "",
    w().ceoStaffHead,
    ...staffOf(snaps, me, org, duties, jobs, peers, now),
    ...(waiting.length > 0 ? ["", w().ceoWaiting, ...waiting.map((j) => w().waitingLine(j.id, j.task, whoIs(j.to)))] : []),
    "",
    w().ceoHandoverTail,
  ].join("\n")
}
