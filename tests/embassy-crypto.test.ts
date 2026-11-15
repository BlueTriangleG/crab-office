import { expect, test } from "claude-code/testing"

import { channelOf, codeSecrets, equalBytes, newKeyPair, newPairCode, normalizeCode, open, seal } from "../hooks/embassy/crypto.ts"

const CODE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/

test("a pairing code is 8 letters and digits that read unambiguously, shown in two fours", () => {
  for (let i = 0; i < 20; i++) expect(newPairCode()).toMatch(CODE)
  expect(normalizeCode(" k7qm 3xhp ")).toBe("K7QM3XHP")
  expect(normalizeCode("K7QM-3XHP")).toBe("K7QM3XHP")
  // 0 is not in the alphabet, and a code is eight characters
  expect(normalizeCode("K7QM-3XH0")).toBeUndefined()
  expect(normalizeCode("K7QM3XH")).toBeUndefined()
})

test("both sides of a code work out the same pairing topic and key, and another code does not", async () => {
  const started = performance.now()
  const a = await codeSecrets("K7QM3XHP")
  // scrypt in plain JS: a code is worked out once per pairing, and must not stall the session
  expect(performance.now() - started).toBeLessThan(3000)
  const b = await codeSecrets("K7QM3XHP")
  const c = await codeSecrets("K7QM3XHQ")
  expect(a.topic).toBe(b.topic)
  expect(a.topic).toMatch(/^co-p-[0-9a-f]{32}$/)
  expect(equalBytes(a.key, b.key)).toBe(true)
  expect(a.topic).not.toBe(c.topic)
  expect(equalBytes(a.key, c.key)).toBe(false)
})

test("both sides derive one channel from the exchange, and the code alone does not give it", async () => {
  const { key } = await codeSecrets("K7QM3XHP")
  const a = newKeyPair()
  const b = newKeyPair()
  const eve = newKeyPair()
  const ours = channelOf(key, a.secret, b.public, a.public, b.public)
  const theirs = channelOf(key, b.secret, a.public, a.public, b.public)
  expect(ours.topic).toBe(theirs.topic)
  expect(ours.topic).toMatch(/^co-c-[0-9a-f]{32}$/)
  expect(equalBytes(ours.key, theirs.key)).toBe(true)
  expect(channelOf(key, eve.secret, a.public, a.public, b.public).topic).not.toBe(ours.topic)
})

test("a sealed text opens only with its key and its label", () => {
  const key = crypto.getRandomValues(new Uint8Array(32))
  const s = seal(key, "接口字段 user_id 是必填的", "m1")
  expect(s).not.toContain("user_id")
  expect(open(key, s, "m1")).toBe("接口字段 user_id 是必填的")
  expect(open(key, s, "m2")).toBeUndefined()
  expect(open(crypto.getRandomValues(new Uint8Array(32)), s, "m1")).toBeUndefined()
  expect(open(key, "not base64 at all", "m1")).toBeUndefined()
  expect(open(key, "", "m1")).toBeUndefined()
})
