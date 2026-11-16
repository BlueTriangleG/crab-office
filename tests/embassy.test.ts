import { expect, test } from "claude-code/testing"

import { channelOf, codeSecrets, fromB64, newKeyPair, normalizeCode, open, seal } from "../hooks/embassy/crypto.ts"
import {
  CODE_TTL_MS,
  DAILY_BUDGET,
  POLL_MS,
  RESEND_MS,
  UNACKED_NOTICE_MS,
  markDelivered,
  pairingsOf,
  queue,
  startJoin,
  startOffer,
  step,
  undelivered,
  unpair,
} from "../hooks/embassy/embassy.ts"
import type { Disk, EmbassyEvent } from "../hooks/embassy/embassy.ts"
import { decode } from "../hooks/embassy/wire.ts"
import type { Relay } from "../hooks/embassy/wire.ts"

const T0 = 1_800_000_000_000

// Two offices on one in-memory disk ("/a" and "/b"), and a relay that keeps
// every topic's messages as ntfy does, numbered n1, n2, ... in order.
function twoSides() {
  const files = new Map<string, string>()
  const disk: Disk = {
    read: async (p) => files.get(p),
    write: async (p, t) => void files.set(p, t),
    list: async (d) => [...files.keys()].filter((p) => p.startsWith(`${d}/`) && !p.slice(d.length + 1).includes("/")).map((p) => p.slice(d.length + 1)),
  }
  const topics = new Map<string, { id: string; time: number; body: string }[]>()
  const clock = { now: T0 }
  const fault: { reason?: string } = {}
  let n = 0
  const relay: Relay = {
    publish: async (topic, body) => {
      if (fault.reason !== undefined) return { ok: false, reason: fault.reason }
      const id = `n${++n}`
      topics.set(topic, [...(topics.get(topic) ?? []), { id, time: Math.floor(clock.now / 1000), body }])
      return { ok: true, id }
    },
    poll: async (topic, since) => {
      if (fault.reason !== undefined) return { ok: false, reason: fault.reason }
      const all = topics.get(topic) ?? []
      const after = since === "all" ? all : all.slice(all.findIndex((m) => m.id === since) + 1)
      return { ok: true, items: after.flatMap((m) => { const envelope = decode(m.body); return envelope === undefined ? [] : [{ id: m.id, time: m.time, envelope }] }) }
    },
  }
  const at = (dir: string, name: string) => (t: number) => {
    clock.now = t
    return step(dir, disk, relay, { name }, t)
  }
  return { files, disk, relay, topics, clock, fault, a: at("/a", "Sam"), b: at("/b", "Dana"), c: at("/c", "Eve") }
}

const kinds = (events: EmbassyEvent[]) => events.map((e) => e.kind)

async function paired() {
  const s = twoSides()
  const code = await startOffer("/a", s.disk, T0)
  await s.a(T0)
  expect(await startJoin("/b", s.disk, code, T0 + 1000)).toEqual({ ok: true })
  await s.b(T0 + 1000)
  // the offerer polls its code every MIN_POLL_GAP_MS; the joiner its channel every POLL_MS
  await s.a(T0 + 6000)
  await s.b(T0 + 6000 + POLL_MS)
  const [pa] = await pairingsOf("/a", s.disk)
  const [pb] = await pairingsOf("/b", s.disk)
  if (pa === undefined || pb === undefined) throw new Error("not paired")
  return { ...s, code, pa, pb }
}

test("a code pairs the two sides, and each knows the other by name", async () => {
  const s = twoSides()
  const code = await startOffer("/a", s.disk, T0)
  expect(kinds(await s.a(T0))).toEqual([])
  expect(await startJoin("/b", s.disk, code, T0 + 1000)).toEqual({ ok: true })
  // the joiner has answered, but is paired only once the offerer confirms
  expect(kinds(await s.b(T0 + 1000))).toEqual([])
  const a = await s.a(T0 + 6000)
  expect(a.find((e) => e.kind === "paired")).toMatchObject({ pairing: { peer: { name: "Dana" } } })
  const b = await s.b(T0 + 6000 + POLL_MS)
  expect(b.find((e) => e.kind === "paired")).toMatchObject({ pairing: { peer: { name: "Sam" } } })
  expect((await pairingsOf("/a", s.disk)).map((p) => p.topic)).toEqual((await pairingsOf("/b", s.disk)).map((p) => p.topic))
  expect(await startJoin("/b", s.disk, "not a code", T0)).toEqual({ ok: false, reason: "bad-code" })
})

test("a wrong code pairs nobody", async () => {
  const s = twoSides()
  const code = await startOffer("/a", s.disk, T0)
  await s.a(T0)
  const other = normalizeCode(code)?.startsWith("2") ? "3333-3333" : "2222-2222"
  await startJoin("/b", s.disk, other, T0 + 1000)
  await s.b(T0 + 1000)
  await s.a(T0 + 2000)
  expect(await pairingsOf("/a", s.disk)).toHaveLength(0)
  expect(kinds(await s.b(T0 + CODE_TTL_MS + 2000))).toContain("expired")
  expect(await pairingsOf("/b", s.disk)).toHaveLength(0)
})

test("a code is good for ten minutes", async () => {
  const s = twoSides()
  const code = await startOffer("/a", s.disk, T0)
  await s.a(T0)
  await startJoin("/b", s.disk, code, T0 + CODE_TTL_MS + 1)
  await s.b(T0 + CODE_TTL_MS + 1)
  expect(kinds(await s.a(T0 + CODE_TTL_MS + 2))).toContain("expired")
  expect(await pairingsOf("/a", s.disk)).toHaveLength(0)
})

test("a code pairs one side only: a second joiner is left unpaired", async () => {
  const s = await paired()
  await startJoin("/c", s.disk, s.code, T0 + 5000)
  await s.c(T0 + 5000)
  await s.a(T0 + 6000 + POLL_MS)
  expect(await pairingsOf("/a", s.disk)).toHaveLength(1)
  expect(kinds(await s.c(T0 + 5000 + CODE_TTL_MS + POLL_MS))).toContain("expired")
  expect(await pairingsOf("/c", s.disk)).toHaveLength(0)
})

test("whoever learns the code afterwards, with every message the relay held, reads nothing", async () => {
  const s = await paired()
  await queue("/a", s.disk, s.pa.id, "the user_id field is required", T0 + 10_000)
  await s.a(T0 + 10_000 + POLL_MS)
  const { key } = await codeSecrets(normalizeCode(s.code) ?? "")
  const bodies = [...s.topics.values()].flat().map((m) => decode(m.body)).flatMap((e) => (e !== undefined && "body" in e && typeof e.body === "string" ? [{ id: e.id, body: e.body, part: (e as { part?: [number, number] }).part }] : []))
  expect(bodies.length).toBeGreaterThan(0)
  for (const b of bodies) for (const aad of [b.id, `${b.id}:${b.part?.[0] ?? 0}`]) expect(open(key, b.body, aad)?.includes("user_id") ?? false).toBe(false)
  expect([...s.topics.values()].flat().some((m) => m.body.includes("user_id"))).toBe(false)
  // the channel needs a secret key of the exchange, which never left either side
  const offer = [...s.topics.values()].flat().map((m) => decode(m.body)).find((e) => e !== undefined && "kind" in e && e.kind === "offer")
  const accept = [...s.topics.values()].flat().map((m) => decode(m.body)).find((e) => e !== undefined && "kind" in e && e.kind === "accept")
  const pubs = [offer, accept].map((e) => fromB64((e as unknown as { pub: string }).pub))
  expect(channelOf(key, newKeyPair().secret, pubs[0] ?? new Uint8Array(), pubs[0] ?? new Uint8Array(), pubs[1] ?? new Uint8Array()).topic).not.toBe(s.pa.topic)
})

test("a message goes across, is handed over once, and its sender hears it arrived", async () => {
  const s = await paired()
  const q = await queue("/a", s.disk, s.pa.id, "我们周三前把接口文档发给你们", T0 + 10_000)
  expect(q).toMatchObject({ ok: true })
  await s.a(T0 + 10_000 + POLL_MS)
  const got = (await s.b(T0 + 10_000 + 2 * POLL_MS)).filter((e) => e.kind === "message")
  expect(got).toHaveLength(1)
  expect(got[0]).toMatchObject({ message: { text: "我们周三前把接口文档发给你们" }, pairing: { peer: { name: "Sam" } } })
  expect((await undelivered("/b", s.disk)).map((m) => m.text)).toEqual(["我们周三前把接口文档发给你们"])
  await markDelivered("/b", s.disk, got[0]?.kind === "message" ? got[0].message.id : "", T0 + 10_000 + 2 * POLL_MS)
  expect(await undelivered("/b", s.disk)).toHaveLength(0)
  await s.a(T0 + 10_000 + 3 * POLL_MS)
  const sent = JSON.parse(s.files.get(`/a/outbox/${q.ok ? q.id : ""}.json`) ?? "{}") as { ackedAt?: number }
  expect(sent.ackedAt).toBeDefined()
})

test("a message seen twice on the relay is handed over once", async () => {
  const s = await paired()
  const q = await queue("/a", s.disk, s.pa.id, "once", T0 + 10_000)
  await s.a(T0 + 10_000 + POLL_MS)
  // published again (as after RESEND_MS), before the first copy was acknowledged
  s.files.set(`/a/outbox/${q.ok ? q.id : ""}.json`, JSON.stringify({ ...JSON.parse(s.files.get(`/a/outbox/${q.ok ? q.id : ""}.json`) ?? "{}"), sentAt: undefined }))
  await s.a(T0 + 10_000 + 2 * POLL_MS)
  const got = (await s.b(T0 + 10_000 + 3 * POLL_MS)).filter((e) => e.kind === "message")
  expect(got).toHaveLength(1)
})

test("a long message arrives whole", async () => {
  const s = await paired()
  const text = "接口的字段说明，".repeat(1200)
  await queue("/a", s.disk, s.pa.id, text, T0 + 10_000)
  await s.a(T0 + 10_000 + POLL_MS)
  const got = (await s.b(T0 + 10_000 + 2 * POLL_MS)).filter((e) => e.kind === "message")
  expect(got.map((e) => (e.kind === "message" ? e.message.text : ""))).toEqual([text])
})

test("an unacknowledged message is published again after RESEND_MS", async () => {
  const s = await paired()
  await queue("/a", s.disk, s.pa.id, "are you there", T0 + 10_000)
  await s.a(T0 + 10_000 + POLL_MS)
  const count = () => (s.topics.get(s.pa.topic) ?? []).filter((m) => (decode(m.body) as { kind?: string } | undefined)?.kind === "msg").length
  expect(count()).toBe(1)
  await s.a(T0 + 10_000 + 2 * POLL_MS)
  expect(count()).toBe(1)
  await s.a(T0 + 10_000 + POLL_MS + RESEND_MS + 1)
  expect(count()).toBe(2)
})

test("a message unanswered for UNACKED_NOTICE_MS is reported once", async () => {
  const s = await paired()
  await queue("/a", s.disk, s.pa.id, "are you there", T0 + 10_000)
  await s.a(T0 + 10_000 + POLL_MS)
  expect(kinds(await s.a(T0 + 10_000 + POLL_MS + UNACKED_NOTICE_MS + 1))).toContain("unacked")
  expect(kinds(await s.a(T0 + 10_000 + 2 * POLL_MS + UNACKED_NOTICE_MS + 1))).not.toContain("unacked")
})

test("a relay that fails keeps the outbox and says why once", async () => {
  const s = await paired()
  const q = await queue("/a", s.disk, s.pa.id, "hello", T0 + 10_000)
  s.fault.reason = "unreachable: blocked by policy"
  const first = await s.a(T0 + 10_000 + POLL_MS)
  expect(first.filter((e) => e.kind === "relay-failed")).toEqual([{ kind: "relay-failed", reason: "unreachable: blocked by policy" }])
  expect(kinds(await s.a(T0 + 10_000 + 2 * POLL_MS))).not.toContain("relay-failed")
  const out = () => JSON.parse(s.files.get(`/a/outbox/${q.ok ? q.id : ""}.json`) ?? "{}") as { sentAt?: number }
  expect(out().sentAt).toBeUndefined()
  delete s.fault.reason
  await s.a(T0 + 10_000 + 3 * POLL_MS)
  expect(out().sentAt).toBeDefined()
})

test("the outbox stops at DAILY_BUDGET publishes a day and says so once", async () => {
  const s = await paired()
  const day = new Date(T0 + 10_000).toISOString().slice(0, 10)
  s.files.set("/a/budget.json", JSON.stringify({ day, count: DAILY_BUDGET }))
  await queue("/a", s.disk, s.pa.id, "one more", T0 + 10_000)
  const before = (s.topics.get(s.pa.topic) ?? []).length
  expect(kinds(await s.a(T0 + 10_000 + POLL_MS))).toContain("over-budget")
  expect(kinds(await s.a(T0 + 10_000 + 2 * POLL_MS))).not.toContain("over-budget")
  expect((s.topics.get(s.pa.topic) ?? []).length).toBe(before)
})

test("an envelope of another version is reported, not dropped silently", async () => {
  const s = await paired()
  await s.relay.publish(s.pb.topic, '{"v":2,"kind":"msg","from":"x","id":"y"}')
  const events = await s.b(T0 + 6000 + 2 * POLL_MS)
  expect(events.filter((e) => e.kind === "unknown-version")).toEqual([{ kind: "unknown-version", v: 2 }])
})

test("either side can end a pairing, and the other hears it", async () => {
  const s = await paired()
  expect(await unpair("/a", s.disk, s.relay, s.pa.id, T0 + 10_000)).toBe(true)
  expect(await pairingsOf("/a", s.disk)).toHaveLength(0)
  expect(kinds(await s.b(T0 + 6000 + 2 * POLL_MS))).toContain("ended")
  expect(await pairingsOf("/b", s.disk)).toHaveLength(0)
  expect(await queue("/a", s.disk, s.pa.id, "still there?", T0 + 20_000)).toEqual({ ok: false, reason: "no-pairing" })
})

test("a message holding a key is not queued", async () => {
  const s = await paired()
  expect(await queue("/a", s.disk, s.pa.id, "use sk-ant-api03-" + "x".repeat(40), T0)).toMatchObject({ ok: false, reason: "secret" })
  expect(await s.disk.list("/a/outbox")).toHaveLength(0)
})

// The relay allows a burst of 60 requests, then one every 5 s: a code waiting
// to be used, or many pairings, must stay under it.
function counting(s: ReturnType<typeof twoSides>) {
  let polls = 0
  const relay: Relay = { publish: s.relay.publish, poll: (t, since) => ((polls += 1), s.relay.poll(t, since)) }
  return { relay, polls: () => polls }
}

test("a code waiting to be used asks the relay at most once every 5 s", async () => {
  const s = twoSides()
  const c = counting(s)
  await startOffer("/a", s.disk, T0)
  for (let t = 0; t < 60_000; t += 1000) await step("/a", s.disk, c.relay, { name: "Sam" }, T0 + t)
  expect(c.polls()).toBeLessThanOrEqual(12)
  expect(c.polls()).toBeGreaterThan(0)
})

test("many pairings together ask the relay at most once every 5 s", async () => {
  const s = twoSides()
  const c = counting(s)
  for (let i = 0; i < 6; i++)
    s.files.set(`/a/pairings/p${i}.json`, JSON.stringify({ id: `p${i}`, topic: `co-c-${i}`, key: "AAAA", side: "s", peer: { name: `P${i}` }, since: "all", at: T0, confirmed: true }))
  for (let t = 0; t < 60_000; t += 1000) await step("/a", s.disk, c.relay, { name: "Sam" }, T0 + t)
  expect(c.polls()).toBeLessThanOrEqual(12)
})

test("a broken part on the channel does not stop the messages after it", async () => {
  const s = await paired()
  // sealed with the channel's key, so only its numbering is wrong
  const body = seal(fromB64(s.pa.key), "x", "bad:0")
  await s.relay.publish(s.pa.topic, JSON.stringify({ v: 1, kind: "msg", from: s.pa.side, id: "bad", part: [0, -1], body }))
  await queue("/a", s.disk, s.pa.id, "still here", T0 + 10_000)
  await s.a(T0 + 10_000 + POLL_MS)
  const got = (await s.b(T0 + 10_000 + 2 * POLL_MS)).filter((e) => e.kind === "message")
  expect(got.map((e) => (e.kind === "message" ? e.message.text : ""))).toEqual(["still here"])
})

test("a message too long to be put back together is refused, not dropped on the other side", async () => {
  const s = await paired()
  expect(await queue("/a", s.disk, s.pa.id, "字".repeat(64 * 800 + 1), T0)).toEqual({ ok: false, reason: "too-long" })
})
