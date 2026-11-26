import { hmac } from "@noble/hashes/hmac.js";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

const PEPPER = "moss-post-office:auth:v3:";
const ITERATIONS = 100_000;

const encoder = new TextEncoder();

function toHex(bytes) {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

function fromHex(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error("invalid hex");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Password never leaves the browser. The server stores this 32-byte verifier
 * and later verifies HMAC proofs over one-time nonces.
 */
export async function deriveVerifier(username, password) {
  const salt = encoder.encode(PEPPER + String(username).trim().toLowerCase());
  const key = await pbkdf2Async(sha256, encoder.encode(String(password)), salt, {
    c: ITERATIONS,
    dkLen: 32
  });
  return toHex(key);
}

export function proveVerifier(verifierHex, nonce) {
  return toHex(hmac(sha256, fromHex(verifierHex), encoder.encode(String(nonce))));
}
