import { LEAVE_MS, peerOf } from "./office.ts"
import type { Snapshot } from "./office.ts"
import { w } from "./words.ts"

// A meeting, as one file per meeting and session (`meetings/<id>.<sessionId>.json`)
// so each has one writer: whoever called it opens and closes it in its own; any
// member brings others to the table in its own; each counts its own words.
export type MeetingFile = {
  id: string
  writer: string
  members: string[]
  said: number
  lastAt: number
  open?: { name: string; topic: string; at: number }
  // An empty conclusion: it ended with none.
  close?: { at: number; conclusion: string }
}

// open and full are live, full waiting for its conclusion; closed, idle and
// empty are over, the last two with no conclusion.
export type MeetingStatus = "open" | "full" | "closed" | "idle" | "empty"
export type Meeting = {
  id: string
  name: string
  topic: string
  by: string
  at: number
  members: string[]
  said: number
  lastAt: number
  status: MeetingStatus
  conclusion?: string
}

// Sessions that answer every word they hear could talk on for ever: code, not
// the models, ends a meeting gone quiet and stops passing words on past a cap.
export const MEETING = { idleMs: 15 * 60_000, saidMax: 30 }

const NAME_MAX = 24

export const isLiveMeeting = (m: Meeting): boolean => m.status === "open" || m.status === "full"

export function meetingsOf(files: MeetingFile[], snaps: Snapshot[], now: number): Meeting[] {
  const present = new Set(snaps.filter((s) => s.ended !== true && now - s.updatedAt < LEAVE_MS).map((s) => s.sessionId))
  return files.flatMap((f): Meeting[] => {
    if (f.open === undefined) return []
    const own = files.filter((x) => x.id === f.id)
    const base = {
      id: f.id,
      name: f.open.name,
      topic: f.open.topic,
      by: f.writer,
      at: f.open.at,
      members: [...new Set([...f.members, ...own.flatMap((x) => x.members)])],
      said: own.reduce((n, x) => n + x.said, 0),
      lastAt: Math.max(f.open.at, ...own.map((x) => x.lastAt)),
    }
    if (f.close !== undefined) return [{ ...base, status: "closed", conclusion: f.close.conclusion }]
    const here = base.members.filter((id) => present.has(id)).length
    const status = here < 2 ? "empty" : now - base.lastAt > MEETING.idleMs ? "idle" : base.said >= MEETING.saidMax ? "full" : "open"
    return [{ ...base, status }]
  })
}

// The meeting a name means: the live one, else the latest that ended, so a word
// to one that is over is told so rather than sent on as a session's name.
export function meetingNamed(name: string, meetings: Meeting[]): Meeting | undefined {
  const named = meetings.filter((m) => m.name.toLowerCase() === name.trim().toLowerCase())
  return named.find(isLiveMeeting) ?? [...named].sort((a, b) => b.at - a.at)[0]
}

// A meeting's name is what SendMessage is addressed to, so it is one word and
// means nothing else: not CEO, no session's name or title, no live meeting's.
export function meetingNameRefusal(
  name: string,
  meetings: Meeting[],
  titles: Record<string, string>,
  snaps: Snapshot[],
  peers: unknown[],
  now: number,
): string | undefined {
  const n = name.trim()
  if (n === "" || n.length > NAME_MAX || /\s/.test(n)) return w().tool.badMeetingName(NAME_MAX)
  const lower = n.toLowerCase()
  const present = new Set(snaps.filter((s) => now - s.updatedAt < LEAVE_MS).map((s) => s.sessionId))
  const isTaken =
    lower === "ceo" ||
    peerOf(peers, n) !== undefined ||
    Object.entries(titles).some(([id, t]) => present.has(id) && t.toLowerCase() === lower) ||
    meetings.some((m) => isLiveMeeting(m) && m.name.toLowerCase() === lower)
  return isTaken ? w().tool.meetingNameTaken(n) : undefined
}

export function speakRefusal(m: Meeting, me: string): string | undefined {
  if (!m.members.includes(me)) return w().tool.notInMeeting(m.name)
  if (!isLiveMeeting(m)) return w().tool.meetingOver(m.name)
  return m.status === "full" ? w().tool.meetingFull(m.name, MEETING.saidMax) : undefined
}

export function closeRefusal(m: Meeting, me: string): string | undefined {
  if (!isLiveMeeting(m)) return w().tool.meetingOver(m.name)
  return m.by === me ? undefined : w().tool.onlyCaller
}
