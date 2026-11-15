import { channelOf, codeSecrets, equalBytes, fromB64, newKeyPair, newPairCode, normalizeCode, open, proofOf, seal, toB64 } from "./crypto.ts"
import { secretsIn } from "./guard.ts"
import { encode, partsOf } from "./wire.ts"
import type { Envelope, Foreign, Relay } from "./wire.ts"

// Pairing and messages between two offices. Everything goes through the two
// ports, a Disk and a Relay, so both sides of a pairing run in one plain test
// and in a script on another machine as well as in the mod.

export const CODE_TTL_MS = 10 * 60_000
export const POLL_MS = 20_000
// The relay keeps a message twelve hours; one not acknowledged by then is
// published again before it can be lost.
export const RESEND_MS = 11 * 3_600_000
export const UNACKED_NOTICE_MS = 30 * 60_000
// Under the relay's 250 a day for an IP, which every pairing, retry and ack shares.
export const DAILY_BUDGET = 200

export type Disk = {
  read: (path: string) => Promise<string | undefined>
  write: (path: string, text: string) => Promise<void>
  // File names in the directory.
  list: (dir: string) => Promise<string[]>
}
export type Hello = { name: string }
export type Pairing = {
  id: string
  topic: string
  key: string
  side: string
  peer: Hello
  since: string
  at: number
  // The joiner counts itself paired once the offerer has acknowledged its
  // accept: a second person holding the same code is left with nothing.
  confirmed: boolean
  acceptId?: string
  ended?: number
}
export type Outgoing = { id: string; pairing: string; text: string; at: number; sentAt?: number; ackedAt?: number; noticedAt?: number }
export type Incoming = { id: string; pairing: string; text: string; at: number; deliveredAt?: number }
export type EmbassyEvent =
  | { kind: "paired"; pairing: Pairing }
  | { kind: "message"; pairing: Pairing; message: Incoming }
  | { kind: "unacked"; pairing: Pairing; message: Outgoing }
  | { kind: "ended"; pairing: Pairing }
  | { kind: "expired" }
  | { kind: "relay-failed"; reason: string }
  | { kind: "over-budget" }
  | { kind: "unknown-version"; v: unknown }

type Pending = {
  role: "offer" | "join"
  code: string
  topic: string
  codeKey: string
  side: string
  at: number
  expires: number
  secret?: string
  public?: string
  offerId?: string
  since?: string
}
type Budget = { day: string; count: number; told?: string }
type Ctx = { dir: string; disk: Disk; relay: Relay; now: number; events: EmbassyEvent[]; budget: Budget; failing: { reason?: string }; failed: boolean }

const NAME_MAX = 60

function newId(): string {
  return [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function readJson<T>(disk: Disk, path: string): Promise<T | undefined> {
  const text = await disk.read(path)
  if (text === undefined) return undefined
  try {
    return (JSON.parse(text) as T | null) ?? undefined
  } catch {
    return undefined
  }
}

const writeJson = (disk: Disk, path: string, value: unknown) => disk.write(path, JSON.stringify(value ?? null))

// The step on the tick and the hooks that queue or hand over run in one
// process, and each reads then writes the same index files: one at a time.
const locks = new Map<string, Promise<unknown>>()
function serial<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const run = (locks.get(dir) ?? Promise.resolve()).then(fn, fn)
  locks.set(dir, run.catch(() => undefined))
  return run
}

function helloOf(text: string | undefined): Hello | undefined {
  if (text === undefined) return undefined
  try {
    const name = (JSON.parse(text) as { name?: unknown }).name
    return typeof name === "string" && name.trim() !== "" ? { name: name.trim().slice(0, NAME_MAX) } : undefined
  } catch {
    return undefined
  }
}

const isOurs = (e: Envelope | Foreign): e is Envelope => "kind" in e

export function startOffer(dir: string, disk: Disk, now: number): Promise<string> {
  return serial(dir, async () => {
    const code = newPairCode()
    const { topic, key } = await codeSecrets(normalizeCode(code) ?? code)
    const pair = newKeyPair()
    const pending: Pending = { role: "offer", code, topic, codeKey: toB64(key), side: newId(), at: now, expires: now + CODE_TTL_MS, secret: toB64(pair.secret), public: toB64(pair.public) }
    await writeJson(disk, `${dir}/pending.json`, pending)
    return code
  })
}

export function startJoin(dir: string, disk: Disk, code: string, now: number): Promise<{ ok: true } | { ok: false; reason: "bad-code" }> {
  return serial(dir, async () => {
    const normal = normalizeCode(code)
    if (normal === undefined) return { ok: false as const, reason: "bad-code" as const }
    const { topic, key } = await codeSecrets(normal)
    const pending: Pending = { role: "join", code: normal, topic, codeKey: toB64(key), side: newId(), at: now, expires: now + CODE_TTL_MS }
    await writeJson(disk, `${dir}/pending.json`, pending)
    return { ok: true as const }
  })
}

function fail(ctx: Ctx, reason: string) {
  ctx.failed = true
  if (ctx.failing.reason === reason) return
  ctx.failing.reason = reason
  ctx.events.push({ kind: "relay-failed", reason })
}

async function send(ctx: Ctx, topic: string, e: Envelope): Promise<boolean> {
  if (ctx.failed) return false
  if (ctx.budget.count >= DAILY_BUDGET) {
    if (ctx.budget.told !== ctx.budget.day) {
      ctx.budget.told = ctx.budget.day
      ctx.events.push({ kind: "over-budget" })
    }
    return false
  }
  const r = await ctx.relay.publish(topic, encode(e))
  if (!r.ok) {
    fail(ctx, r.reason)
    return false
  }
  ctx.budget.count += 1
  delete ctx.failing.reason
  return true
}

async function poll(ctx: Ctx, topic: string, since: string) {
  if (ctx.failed) return undefined
  const r = await ctx.relay.poll(topic, since)
  if (!r.ok) {
    fail(ctx, r.reason)
    return undefined
  }
  delete ctx.failing.reason
  return r.items
}

async function stepOffer(ctx: Ctx, p: Pending, me: Hello) {
  const { dir, disk, now } = ctx
  const codeKey = fromB64(p.codeKey)
  const pub = fromB64(p.public ?? "")
  if (p.offerId === undefined) {
    const id = newId()
    const offer: Envelope = { v: 1, kind: "offer", from: p.side, id, pub: p.public ?? "", proof: toB64(proofOf(codeKey, "offer", pub)), body: seal(codeKey, JSON.stringify(me), id) }
    if (!(await send(ctx, p.topic, offer))) return
    p.offerId = id
    await writeJson(disk, `${dir}/pending.json`, p)
  }
  const items = await poll(ctx, p.topic, p.since ?? "all")
  if (items === undefined) return
  for (const item of items) {
    p.since = item.id
    const e = item.envelope
    if (!isOurs(e) || e.kind !== "accept" || e.from === p.side || e.pub === undefined || e.proof === undefined || e.body === undefined) continue
    try {
      const theirs = fromB64(e.pub)
      if (!equalBytes(fromB64(e.proof), proofOf(codeKey, "accept", pub, theirs))) continue
      const channel = channelOf(codeKey, fromB64(p.secret ?? ""), theirs, pub, theirs)
      const peer = helloOf(open(channel.key, e.body, e.id))
      if (peer === undefined) continue
      const pairing: Pairing = { id: newId(), topic: channel.topic, key: toB64(channel.key), side: p.side, peer, since: "all", at: now, confirmed: true }
      await writeJson(disk, `${dir}/pairings/${pairing.id}.json`, pairing)
      await writeJson(disk, `${dir}/pending.json`, null)
      await send(ctx, channel.topic, { v: 1, kind: "ack", from: p.side, id: e.id })
      ctx.events.push({ kind: "paired", pairing })
      return
    } catch {
      // A broken accept is someone else's noise on a topic anyone can post to.
    }
  }
  await writeJson(disk, `${dir}/pending.json`, p)
}

async function stepJoin(ctx: Ctx, p: Pending, me: Hello) {
  const { dir, disk, now } = ctx
  const codeKey = fromB64(p.codeKey)
  const items = await poll(ctx, p.topic, "all")
  if (items === undefined) return
  for (const item of items) {
    const e = item.envelope
    if (!isOurs(e) || e.kind !== "offer" || e.from === p.side || e.pub === undefined || e.proof === undefined || e.body === undefined) continue
    // An offer older than a code lasts is a code that has run out.
    if (item.time * 1000 < now - CODE_TTL_MS) continue
    try {
      const theirs = fromB64(e.pub)
      if (!equalBytes(fromB64(e.proof), proofOf(codeKey, "offer", theirs))) continue
      const peer = helloOf(open(codeKey, e.body, e.id))
      if (peer === undefined) continue
      const pair = newKeyPair()
      const channel = channelOf(codeKey, pair.secret, theirs, theirs, pair.public)
      const id = newId()
      const accept: Envelope = { v: 1, kind: "accept", from: p.side, id, pub: toB64(pair.public), proof: toB64(proofOf(codeKey, "accept", theirs, pair.public)), body: seal(channel.key, JSON.stringify(me), id) }
      if (!(await send(ctx, p.topic, accept))) return
      const pairing: Pairing = { id: newId(), topic: channel.topic, key: toB64(channel.key), side: p.side, peer, since: "all", at: now, confirmed: false, acceptId: id }
      await writeJson(disk, `${dir}/pairings/${pairing.id}.json`, pairing)
      await writeJson(disk, `${dir}/pending.json`, null)
      return
    } catch {
      // As above: not an offer anyone made with this code.
    }
  }
}

async function stepPending(ctx: Ctx, me: Hello) {
  const p = await readJson<Pending>(ctx.disk, `${ctx.dir}/pending.json`)
  if (p === undefined) return
  if (ctx.now > p.expires) {
    await writeJson(ctx.disk, `${ctx.dir}/pending.json`, null)
    ctx.events.push({ kind: "expired" })
    return
  }
  await (p.role === "offer" ? stepOffer(ctx, p, me) : stepJoin(ctx, p, me))
}

async function allPairings(disk: Disk, dir: string): Promise<Pairing[]> {
  const names = (await disk.list(`${dir}/pairings`)).filter((n) => n.endsWith(".json"))
  const all = await Promise.all(names.map((n) => readJson<Pairing>(disk, `${dir}/pairings/${n}`)))
  return all.filter((p): p is Pairing => p !== undefined && p.ended === undefined)
}

async function listOf(disk: Disk, path: string): Promise<string[]> {
  return (await readJson<string[]>(disk, path)) ?? []
}

async function received(ctx: Ctx, pairing: Pairing, key: Uint8Array, e: Envelope) {
  const { dir, disk, now } = ctx
  const [n, of] = e.part ?? [0, 1]
  const text = e.body === undefined ? undefined : open(key, e.body, `${e.id}:${n}`)
  if (text === undefined) return
  const ack: Envelope = { v: 1, kind: "ack", from: pairing.side, id: e.id }
  // Seen before: published again because our ack was lost. Ack it again.
  if ((await disk.read(`${dir}/inbox/${e.id}.json`)) !== undefined) {
    if (n === of - 1) await send(ctx, pairing.topic, ack)
    return
  }
  const partsPath = `${dir}/parts/${e.id}.json`
  const parts = (of > 1 ? await readJson<Record<string, string>>(disk, partsPath) : undefined) ?? {}
  parts[String(n)] = text
  if (Object.keys(parts).length < of) {
    await writeJson(disk, partsPath, parts)
    return
  }
  const message: Incoming = { id: e.id, pairing: pairing.id, text: Array.from({ length: of }, (_, i) => parts[String(i)] ?? "").join(""), at: now }
  await writeJson(disk, `${dir}/inbox/${e.id}.json`, message)
  await writeJson(disk, `${dir}/unread.json`, [...(await listOf(disk, `${dir}/unread.json`)), e.id])
  ctx.events.push({ kind: "message", pairing, message })
  await send(ctx, pairing.topic, ack)
}

async function acked(ctx: Ctx, pairing: Pairing, id: string) {
  if (!pairing.confirmed && id === pairing.acceptId) {
    pairing.confirmed = true
    ctx.events.push({ kind: "paired", pairing })
    return
  }
  const path = `${ctx.dir}/outbox/${id}.json`
  const out = await readJson<Outgoing>(ctx.disk, path)
  if (out === undefined || out.pairing !== pairing.id || out.ackedAt !== undefined) return
  await writeJson(ctx.disk, path, { ...out, ackedAt: ctx.now })
  await writeJson(ctx.disk, `${ctx.dir}/open.json`, (await listOf(ctx.disk, `${ctx.dir}/open.json`)).filter((x) => x !== id))
}

async function stepPairings(ctx: Ctx) {
  const { dir, disk, now } = ctx
  const polledPath = `${dir}/polled.json`
  const polled = (await readJson<Record<string, number>>(disk, polledPath)) ?? {}
  let isPolled = false
  for (const pairing of await allPairings(disk, dir)) {
    if (!pairing.confirmed && now - pairing.at > CODE_TTL_MS) {
      await writeJson(disk, `${dir}/pairings/${pairing.id}.json`, { ...pairing, ended: now })
      ctx.events.push({ kind: "expired" })
      continue
    }
    if (now - (polled[pairing.id] ?? 0) < POLL_MS) continue
    polled[pairing.id] = now
    isPolled = true
    const items = await poll(ctx, pairing.topic, pairing.since)
    if (items === undefined) break
    const key = fromB64(pairing.key)
    for (const item of items) {
      pairing.since = item.id
      const e = item.envelope
      if (!isOurs(e)) {
        ctx.events.push({ kind: "unknown-version", v: e.v })
        continue
      }
      if (e.from === pairing.side) continue
      if (e.kind === "ack") await acked(ctx, pairing, e.id)
      else if (e.kind === "msg") await received(ctx, pairing, key, e)
      else if (e.kind === "bye" && e.body !== undefined && open(key, e.body, e.id) === "bye") {
        pairing.ended = now
        ctx.events.push({ kind: "ended", pairing })
        break
      }
    }
    await writeJson(disk, `${dir}/pairings/${pairing.id}.json`, pairing)
  }
  if (isPolled) await writeJson(disk, polledPath, polled)
}

async function stepOutbox(ctx: Ctx) {
  const { dir, disk, now } = ctx
  if (ctx.failed) return
  const ids = await listOf(disk, `${dir}/open.json`)
  if (ids.length === 0) return
  const live = new Map((await allPairings(disk, dir)).filter((p) => p.confirmed).map((p) => [p.id, p]))
  const open = (await Promise.all(ids.map((id) => readJson<Outgoing>(disk, `${dir}/outbox/${id}.json`)))).filter((o): o is Outgoing => o !== undefined)
  for (const out of open.sort((a, b) => a.at - b.at)) {
    const pairing = live.get(out.pairing)
    if (pairing === undefined || out.ackedAt !== undefined) continue
    if (out.sentAt === undefined || now - out.sentAt >= RESEND_MS) {
      const key = fromB64(pairing.key)
      const parts = partsOf(out.text)
      for (const [n, part] of parts.entries()) {
        const e: Envelope = { v: 1, kind: "msg", from: pairing.side, id: out.id, part: [n, parts.length], body: seal(key, part, `${out.id}:${n}`) }
        if (!(await send(ctx, pairing.topic, e))) return
      }
      await writeJson(disk, `${dir}/outbox/${out.id}.json`, { ...out, sentAt: now })
      continue
    }
    if (now - out.sentAt >= UNACKED_NOTICE_MS && out.noticedAt === undefined) {
      const noticed = { ...out, noticedAt: now }
      await writeJson(disk, `${dir}/outbox/${out.id}.json`, noticed)
      ctx.events.push({ kind: "unacked", pairing, message: noticed })
    }
  }
}

export function step(dir: string, disk: Disk, relay: Relay, me: Hello, now: number): Promise<EmbassyEvent[]> {
  return serial(dir, async () => {
    const day = new Date(now).toISOString().slice(0, 10)
    const held = await readJson<Budget>(disk, `${dir}/budget.json`)
    const budget: Budget = held?.day === day ? held : { day, count: 0 }
    const failing = (await readJson<{ reason?: string }>(disk, `${dir}/failing.json`)) ?? {}
    const was = JSON.stringify([budget, failing])
    const ctx: Ctx = { dir, disk, relay, now, events: [], budget, failing, failed: false }
    await stepPending(ctx, me)
    await stepPairings(ctx)
    await stepOutbox(ctx)
    if (JSON.stringify([budget, failing]) !== was) {
      await writeJson(disk, `${dir}/budget.json`, budget)
      await writeJson(disk, `${dir}/failing.json`, failing)
    }
    return ctx.events
  })
}

export function queue(
  dir: string,
  disk: Disk,
  pairingId: string,
  text: string,
  now: number,
): Promise<{ ok: true; id: string } | { ok: false; reason: "no-pairing" } | { ok: false; reason: "secret"; found: string[] }> {
  return serial(dir, async () => {
    const found = secretsIn(text)
    if (found.length > 0) return { ok: false as const, reason: "secret" as const, found }
    const pairing = await readJson<Pairing>(disk, `${dir}/pairings/${pairingId}.json`)
    if (pairing === undefined || pairing.ended !== undefined || !pairing.confirmed) return { ok: false as const, reason: "no-pairing" as const }
    const out: Outgoing = { id: newId(), pairing: pairingId, text, at: now }
    await writeJson(disk, `${dir}/outbox/${out.id}.json`, out)
    await writeJson(disk, `${dir}/open.json`, [...(await listOf(disk, `${dir}/open.json`)), out.id])
    return { ok: true as const, id: out.id }
  })
}

export function undelivered(dir: string, disk: Disk): Promise<Incoming[]> {
  return serial(dir, async () => {
    const ids = await listOf(disk, `${dir}/unread.json`)
    const all = await Promise.all(ids.map((id) => readJson<Incoming>(disk, `${dir}/inbox/${id}.json`)))
    return all.filter((m): m is Incoming => m !== undefined && m.deliveredAt === undefined).sort((a, b) => a.at - b.at)
  })
}

export function markDelivered(dir: string, disk: Disk, id: string, now: number): Promise<void> {
  return serial(dir, async () => {
    const message = await readJson<Incoming>(disk, `${dir}/inbox/${id}.json`)
    if (message !== undefined) await writeJson(disk, `${dir}/inbox/${id}.json`, { ...message, deliveredAt: now })
    await writeJson(disk, `${dir}/unread.json`, (await listOf(disk, `${dir}/unread.json`)).filter((x) => x !== id))
  })
}

// Ended here whether or not the goodbye got out: the other side, unanswered,
// is told its messages are not arriving.
export function unpair(dir: string, disk: Disk, relay: Relay, pairingId: string, now: number): Promise<boolean> {
  return serial(dir, async () => {
    const pairing = await readJson<Pairing>(disk, `${dir}/pairings/${pairingId}.json`)
    if (pairing === undefined || pairing.ended !== undefined) return false
    const id = newId()
    await relay.publish(pairing.topic, encode({ v: 1, kind: "bye", from: pairing.side, id, body: seal(fromB64(pairing.key), "bye", id) }))
    await writeJson(disk, `${dir}/pairings/${pairing.id}.json`, { ...pairing, ended: now })
    return true
  })
}

export function pairingsOf(dir: string, disk: Disk): Promise<Pairing[]> {
  return serial(dir, () => allPairings(disk, dir))
}
