import { expect, test } from "claude-code/testing"
import type { HttpInit, HttpResponse } from "claude-code"

import { PART_BYTES, RELAY, decode, encode, ntfyRelay, partsOf } from "../hooks/embassy/wire.ts"

test("a long message splits into parts that each fit the relay, and join back whole", () => {
  const text = "协商".repeat(3000) + "end"
  const parts = partsOf(text)
  expect(parts.length).toBeGreaterThan(1)
  for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(PART_BYTES)
  expect(parts.join("")).toBe(text)
  expect(partsOf("short")).toEqual(["short"])
  // a hello with nothing to say is still one part
  expect(partsOf("")).toEqual([""])
  // a character outside the basic plane is never cut in half
  expect(partsOf("🦀".repeat(2000)).join("")).toBe("🦀".repeat(2000))
})

test("an envelope from another version is told apart from noise", () => {
  expect(decode(encode({ v: 1, kind: "ack", from: "s1", id: "m1" }))).toMatchObject({ kind: "ack", from: "s1", id: "m1" })
  expect(decode('{"v":2,"kind":"msg"}')).toEqual({ v: 2 })
  expect(decode("hello")).toBeUndefined()
  expect(decode('{"v":1,"kind":"shout","from":"s","id":"m"}')).toBeUndefined()
  expect(decode('{"kind":"msg"}')).toBeUndefined()
})

const ok = (text: string): HttpResponse => ({ status: 200, ok: true, headers: {}, text })

test("the relay posts to the topic and reads back only messages", async () => {
  const calls: { url: string; init?: HttpInit }[] = []
  const relay = ntfyRelay(async (url, init) => {
    calls.push({ url, ...(init === undefined ? {} : { init }) })
    if (init?.method === "POST") return ok(JSON.stringify({ id: "n1", time: 1, event: "message", topic: "co-c-x" }))
    const ours = encode({ v: 1, kind: "ack", from: "s1", id: "m1" })
    return ok(
      [
        JSON.stringify({ id: "k0", time: 1, event: "open", topic: "co-c-x" }),
        JSON.stringify({ id: "n1", time: 2, event: "message", topic: "co-c-x", message: ours }),
        JSON.stringify({ id: "n2", time: 3, event: "message", topic: "co-c-x", message: "someone else's words" }),
        JSON.stringify({ id: "n3", time: 4, event: "message", topic: "co-c-x", message: '{"v":9}' }),
        "",
      ].join("\n"),
    )
  })
  expect(await relay.publish("co-c-x", "body")).toEqual({ ok: true, id: "n1" })
  expect(calls[0]).toMatchObject({ url: `${RELAY}/co-c-x`, init: { method: "POST", body: "body" } })
  const polled = await relay.poll("co-c-x", "all")
  expect(calls[1]?.url).toBe(`${RELAY}/co-c-x/json?poll=1&since=all`)
  expect(polled).toEqual({
    ok: true,
    items: [
      { id: "n1", time: 2, envelope: { v: 1, kind: "ack", from: "s1", id: "m1" } },
      { id: "n3", time: 4, envelope: { v: 9 } },
    ],
  })
})

test("the relay says why when it cannot", async () => {
  const status = (n: number): HttpResponse => ({ status: n, ok: false, headers: {}, text: "" })
  expect(await ntfyRelay(async () => status(429)).publish("t", "b")).toEqual({ ok: false, reason: "rate" })
  expect(await ntfyRelay(async () => status(403)).poll("t", "all")).toEqual({ ok: false, reason: "refused" })
  expect(await ntfyRelay(async () => status(502)).poll("t", "all")).toEqual({ ok: false, reason: "http 502" })
  const blocked = await ntfyRelay(async () => {
    throw new Error("blocked by policy")
  }).publish("t", "b")
  expect(blocked).toEqual({ ok: false, reason: "unreachable: blocked by policy" })
})
