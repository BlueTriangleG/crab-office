// Types for what hooks/vendor/noble.js exports (noble 2.4.0).
type Bytes = Uint8Array
export declare const xchacha20poly1305: (key: Bytes, nonce: Bytes, aad?: Bytes) => { encrypt(plaintext: Bytes): Bytes; decrypt(ciphertext: Bytes): Bytes }
export declare const x25519: {
  utils: { randomSecretKey(): Bytes }
  getPublicKey(secretKey: Bytes): Bytes
  getSharedSecret(secretKey: Bytes, publicKey: Bytes): Bytes
}
type Hash = { (message: Bytes): Bytes; outputLen: number; blockLen: number }
export declare const sha256: Hash
export declare function hmac(hash: Hash, key: Bytes, message: Bytes): Bytes
export declare function hkdf(hash: Hash, ikm: Bytes, salt: Bytes | undefined, info: Bytes | undefined, length: number): Bytes
export declare function scryptAsync(password: Bytes | string, salt: Bytes | string, opts: { N: number; r: number; p: number; dkLen?: number }): Promise<Bytes>
export declare function randomBytes(bytesLength?: number): Bytes
export declare function utf8ToBytes(str: string): Bytes
export declare function bytesToHex(bytes: Bytes): string
export declare function concatBytes(...arrays: Bytes[]): Bytes
