import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM at-rest encryption for the instructor's Google refresh token
// (ADR-007). The refresh token is long-lived and grants calendar access, so it
// is never stored or logged in plain text (security checklist). Layout of the
// stored value, base64-encoded:
//
//   [ iv (12 bytes) ][ authTag (16 bytes) ][ ciphertext ]
//
// The GCM authTag makes tampering detectable: decryptToken throws if the stored
// bytes were altered or the key changed. See lib/calendar/README.md for the key
// format + rotation process.

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}); generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return key;
}

/** Encrypt a secret; returns a base64 payload safe to persist in a column. */
export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Decrypt a payload from {@link encryptToken}. Throws on tamper / wrong key. */
export function decryptToken(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error("ciphertext too short");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8",
  );
}

/**
 * Whether token crypto is usable (key present + correct length). Lets the
 * OAuth connect flow fail soft when `ENCRYPTION_KEY` is unprovisioned, rather
 * than 500 — the rest of the instructor area keeps working.
 */
export function isCalendarCryptoConfigured(): boolean {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return false;
  try {
    return Buffer.from(raw, "base64").length === KEY_BYTES;
  } catch {
    return false;
  }
}
