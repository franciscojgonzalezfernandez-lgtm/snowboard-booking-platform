import { describe, expect, test } from "vitest";
import { BookingSource } from "@prisma/client";

import { parseAttribution } from "./parse";

function parse(query: string) {
  return parseAttribution(new URLSearchParams(query));
}

describe("parseAttribution", () => {
  test("no signal → null", () => {
    expect(parse("")).toBeNull();
    expect(parse("foo=bar&page=2")).toBeNull();
  });

  test("known offline code → its channel + campaign", () => {
    expect(parse("c=flyer-talstation")).toEqual({
      channel: BookingSource.FLYER,
      campaign: "flyer-talstation",
    });
    expect(parse("c=sticker-bergbahn")?.channel).toBe(BookingSource.STICKER);
  });

  test("unknown code → OTHER but still captured", () => {
    expect(parse("c=mystery-code")).toEqual({
      channel: BookingSource.OTHER,
      campaign: "mystery-code",
    });
  });

  test("code is lowercased and charset-guarded", () => {
    expect(parse("c=FLYER-TALSTATION")?.campaign).toBe("flyer-talstation");
    // spaces / illegal chars → not a valid code, and no other signal → null
    expect(parse("c=has%20space")).toBeNull();
  });

  test("code takes precedence over UTM", () => {
    const out = parse("c=flyer-talstation&utm_source=google&utm_medium=cpc");
    expect(out).toEqual({
      channel: BookingSource.FLYER,
      campaign: "flyer-talstation",
    });
  });

  test("utm_medium=cpc → PAID_SEARCH, keeps raw utm fields", () => {
    expect(parse("utm_source=google&utm_medium=cpc&utm_campaign=winter")).toEqual({
      channel: BookingSource.PAID_SEARCH,
      campaign: "winter",
      utmSource: "google",
      utmMedium: "cpc",
    });
  });

  test("utm_medium=organic → ORGANIC_SEARCH", () => {
    expect(parse("utm_source=google&utm_medium=organic")?.channel).toBe(
      BookingSource.ORGANIC_SEARCH,
    );
  });

  test("social from medium or source", () => {
    expect(parse("utm_medium=social")?.channel).toBe(BookingSource.SOCIAL);
    expect(parse("utm_source=instagram")?.channel).toBe(BookingSource.SOCIAL);
  });

  test("referral medium → REFERRAL", () => {
    expect(parse("utm_medium=referral&utm_source=partner")?.channel).toBe(
      BookingSource.REFERRAL,
    );
  });

  test("gclid → PAID_SEARCH, fbclid → SOCIAL even without a medium", () => {
    expect(parse("gclid=abc123")?.channel).toBe(BookingSource.PAID_SEARCH);
    expect(parse("fbclid=xyz789")?.channel).toBe(BookingSource.SOCIAL);
  });

  test("unrecognised utm → OTHER", () => {
    expect(parse("utm_source=newsletter&utm_medium=email")?.channel).toBe(
      BookingSource.OTHER,
    );
  });

  test("over-long values are dropped", () => {
    const long = "x".repeat(100);
    expect(parse(`utm_campaign=${long}`)).toBeNull();
  });
});
