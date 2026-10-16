import { describe, expect, test } from "vitest";
import { BookingSource } from "@prisma/client";

import { decodeAttribution, encodeAttribution } from "./cookie";
import type { Attribution } from "./types";

describe("attribution cookie encode/decode", () => {
  test("round-trips a full attribution", () => {
    const attr: Attribution = {
      channel: BookingSource.PAID_SEARCH,
      campaign: "winter",
      utmSource: "google",
      utmMedium: "cpc",
    };
    expect(decodeAttribution(encodeAttribution(attr))).toEqual(attr);
  });

  test("round-trips a channel-only attribution (offline code)", () => {
    const attr: Attribution = {
      channel: BookingSource.FLYER,
      campaign: "flyer-talstation",
    };
    expect(decodeAttribution(encodeAttribution(attr))).toEqual(attr);
  });

  test("empty / missing value → null", () => {
    expect(decodeAttribution(undefined)).toBeNull();
    expect(decodeAttribution(null)).toBeNull();
    expect(decodeAttribution("")).toBeNull();
  });

  test("malformed JSON → null (never throws)", () => {
    expect(decodeAttribution("not-json")).toBeNull();
    expect(decodeAttribution("%7Bbroken")).toBeNull();
  });

  test("unknown channel is rejected → null", () => {
    const forged = encodeURIComponent(JSON.stringify({ c: "HACKED" }));
    expect(decodeAttribution(forged)).toBeNull();
  });

  test("missing channel → null", () => {
    const noChannel = encodeURIComponent(JSON.stringify({ k: "winter" }));
    expect(decodeAttribution(noChannel)).toBeNull();
  });
});
