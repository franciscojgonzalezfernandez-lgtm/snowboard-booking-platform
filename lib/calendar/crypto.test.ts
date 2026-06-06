import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { randomBytes } from "node:crypto";

import {
  decryptToken,
  encryptToken,
  isCalendarCryptoConfigured,
} from "./crypto";

const TEST_KEY = randomBytes(32).toString("base64");
let originalKey: string | undefined;

beforeAll(() => {
  originalKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = originalKey;
});

describe("encryptToken / decryptToken", () => {
  test("round-trips a value", () => {
    const secret = "1//refresh-token-abc.DEF_ghi-jkl";
    expect(decryptToken(encryptToken(secret))).toBe(secret);
  });

  test("two encryptions of the same value differ (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  test("output is never the plaintext", () => {
    const secret = "plain-secret";
    expect(encryptToken(secret)).not.toContain(secret);
  });

  test("tampering with the ciphertext throws", () => {
    const payload = encryptToken("tamper-me");
    const buf = Buffer.from(payload, "base64");
    const last = buf.length - 1;
    buf[last] = buf[last]! ^ 0xff; // flip a ciphertext byte
    expect(() => decryptToken(buf.toString("base64"))).toThrow();
  });

  test("tampering with the authTag throws", () => {
    const payload = encryptToken("tamper-tag");
    const buf = Buffer.from(payload, "base64");
    buf[12] = buf[12]! ^ 0xff; // first byte of the 16-byte tag
    expect(() => decryptToken(buf.toString("base64"))).toThrow();
  });

  test("a different key cannot decrypt", () => {
    const payload = encryptToken("cross-key");
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decryptToken(payload)).toThrow();
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  test("too-short payload throws", () => {
    expect(() => decryptToken(Buffer.from("short").toString("base64"))).toThrow(
      /too short/,
    );
  });
});

describe("key validation", () => {
  test("missing key throws on use", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptToken("x")).toThrow(/ENCRYPTION_KEY is not set/);
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  test("wrong-length key throws on use", () => {
    process.env.ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    expect(() => encryptToken("x")).toThrow(/32 bytes/);
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  test("isCalendarCryptoConfigured reflects key state", () => {
    expect(isCalendarCryptoConfigured()).toBe(true);
    delete process.env.ENCRYPTION_KEY;
    expect(isCalendarCryptoConfigured()).toBe(false);
    process.env.ENCRYPTION_KEY = Buffer.from("nope").toString("base64");
    expect(isCalendarCryptoConfigured()).toBe(false);
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });
});
