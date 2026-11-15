import type { HttpInit, HttpResponse } from "claude-code"

// What goes over the relay, and the relay itself. ntfy.sh keeps a topic's
// messages twelve hours and serves them to anyone who knows its name, so the
// names are random, the bodies sealed, and nothing here trusts what it reads.

export const RELAY = "https://ntfy.sh"
// ntfy turns a message over 4096 bytes into an attachment; a part this size
// stays under it once sealed, base64'd and wrapped.
export const PART_BYTES = 2400
const KINDS = new Set(["offer", "accept", "msg", "ack", "bye"])

export type Envelope = {
  v: 1
  kind: "offer" | "accept" | "msg" | "ack" | "bye"
  // The sending side's random id: both sides read the one topic, and skip their own.
  from: string
  id: string
  part?: [number, number]
  pub?: string
  proof?: string
  body?: string
}
// Ours, from a version this one does not speak.
export type Foreign = { v: unknown }

export type Sent = { ok: true; id: string } | { ok: false; reason: string }
export type Polled = { ok: true; items: { id: string; time: number; envelope: Envelope | Foreign }[] } | { ok: false; reason: string }
export type Relay = {
  publish: (topic: string, body: string) => Promise<Sent>
  poll: (topic: string, since: string) => Promise<Polled>
}
export type Fetch = (url: string, init?: HttpInit) => Promise<HttpResponse>

export function encode(e: Envelope): string {
  return JSON.stringify(e)
}

// undefined: not ours, or broken. A topic's name is all it takes to post to it.
export function decode(text: string): Envelope | Foreign | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  if (typeof value !== "object" || value === null || !("v" in value)) return undefined
  const e = value as Record<string, unknown>
  if (e.v !== 1) return { v: e.v }
  if (typeof e.kind !== "string" || !KINDS.has(e.kind) || typeof e.from !== "string" || typeof e.id !== "string") return undefined
  return e as unknown as Envelope
}

// Cut on characters, never inside one, each part at most PART_BYTES of UTF-8.
export function partsOf(text: string): string[] {
  const parts: string[] = []
  let part = ""
  let bytes = 0
  for (const ch of text) {
    const size = new TextEncoder().encode(ch).length
    if (bytes + size > PART_BYTES) {
      parts.push(part)
      part = ""
      bytes = 0
    }
    part += ch
    bytes += size
  }
  return [...parts, part]
}

function failure(r: HttpResponse): { ok: false; reason: string } {
  return { ok: false, reason: r.status === 429 ? "rate" : r.status === 403 ? "refused" : `http ${r.status}` }
}

// Takes a fetch rather than the engine: the hooks' `$.http.fetch(url, init)`
// in the mod, a plain function in tests and in a script on the other side.
export function ntfyRelay(fetch: Fetch): Relay {
  const call = async (url: string, init?: HttpInit): Promise<HttpResponse | { ok: false; reason: string }> => {
    try {
      return await fetch(url, init)
    } catch (err) {
      return { ok: false, reason: `unreachable: ${err instanceof Error ? err.message : String(err)}` }
    }
  }
  return {
    publish: async (topic, body) => {
      const r = await call(`${RELAY}/${topic}`, { method: "POST", body })
      if (!("status" in r)) return r
      if (!r.ok) return failure(r)
      try {
        return { ok: true, id: String((JSON.parse(r.text) as { id?: unknown }).id ?? "") }
      } catch {
        // Accepted, as its status says; only its id is missing.
        return { ok: true, id: "" }
      }
    },
    poll: async (topic, since) => {
      const r = await call(`${RELAY}/${topic}/json?poll=1&since=${encodeURIComponent(since)}`)
      if (!("status" in r)) return r
      if (!r.ok) return failure(r)
      const items = r.text.split("\n").flatMap((line) => {
        try {
          const m = JSON.parse(line) as { id?: unknown; time?: unknown; event?: unknown; message?: unknown }
          if (m.event !== "message" || typeof m.message !== "string") return []
          const envelope = decode(m.message)
          return envelope === undefined ? [] : [{ id: String(m.id), time: Number(m.time), envelope }]
        } catch {
          return []
        }
      })
      return { ok: true, items }
    },
  }
}
