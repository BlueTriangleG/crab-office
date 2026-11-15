import { bytesToHex, concatBytes, hkdf, hmac, scryptAsync, sha256, utf8ToBytes, x25519, xchacha20poly1305 } from "../vendor/noble.js"

// What two offices share to pair, and what seals everything said after. The
// hooks runtime has crypto.getRandomValues and subtle.digest alone, so the
// ciphers come from noble, audited and bundled, never put together here.

// No 0/O or 1/I: a code is read off one screen and typed on another.
export const PAIR_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
const CODE_LENGTH = 8
// The pairing topic and key are both drawn from the code through scrypt, so
// whoever sees the topic on the relay cannot try every code in the ten minutes
// a code lasts.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, dkLen: 48 }
const NONCE_BYTES = 24

export function newPairCode(): string {
  // 32 divides 256, so the low five bits of a random byte are uniform.
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  const chars = [...bytes].map((b) => PAIR_ALPHABET[b & 31] ?? "")
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`
}

export function normalizeCode(input: string): string | undefined {
  const code = input.toUpperCase().replace(/[\s-]/g, "")
  return code.length === CODE_LENGTH && [...code].every((c) => PAIR_ALPHABET.includes(c)) ? code : undefined
}

export async function codeSecrets(code: string): Promise<{ topic: string; key: Uint8Array }> {
  const out = await scryptAsync(utf8ToBytes(code), utf8ToBytes("crab-office/pair/v1"), SCRYPT)
  return { topic: `co-p-${bytesToHex(out.slice(0, 16))}`, key: out.slice(16, 48) }
}

export function newKeyPair(): { secret: Uint8Array; public: Uint8Array } {
  const secret = x25519.utils.randomSecretKey()
  return { secret, public: x25519.getPublicKey(secret) }
}

export function proofOf(codeKey: Uint8Array, label: "offer" | "accept", ...pubs: Uint8Array[]): Uint8Array {
  return hmac(sha256, codeKey, concatBytes(utf8ToBytes(label), ...pubs))
}

// The channel comes from the exchange, salted with the code's key: someone who
// learns the code afterwards, holding every message the relay kept, still
// lacks a secret key of the exchange.
export function channelOf(
  codeKey: Uint8Array,
  mySecret: Uint8Array,
  theirPublic: Uint8Array,
  offerPub: Uint8Array,
  acceptPub: Uint8Array,
): { topic: string; key: Uint8Array } {
  const shared = x25519.getSharedSecret(mySecret, theirPublic)
  const okm = hkdf(sha256, shared, codeKey, concatBytes(utf8ToBytes("crab-office/channel/v1"), offerPub, acceptPub), 48)
  return { topic: `co-c-${bytesToHex(okm.slice(0, 16))}`, key: okm.slice(16, 48) }
}

export function seal(key: Uint8Array, text: string, aad: string): string {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const sealed = xchacha20poly1305(key, nonce, utf8ToBytes(aad)).encrypt(utf8ToBytes(text))
  return toB64(concatBytes(nonce, sealed))
}

export function open(key: Uint8Array, sealed: string, aad: string): string | undefined {
  try {
    const bytes = fromB64(sealed)
    const opened = xchacha20poly1305(key, bytes.slice(0, NONCE_BYTES), utf8ToBytes(aad)).decrypt(bytes.slice(NONCE_BYTES))
    return new TextDecoder().decode(opened)
  } catch {
    // A wrong key, a wrong label, a cut or forged text: none of them is ours to read.
    return undefined
  }
}

export function toB64(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b))
}

export function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}
