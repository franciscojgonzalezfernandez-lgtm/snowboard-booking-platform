import { Duration } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { FALLBACK_PRICES, hasTokens, interpolateTokens } from "./tokens";
import { SEASON } from "@/lib/seo/business";

const PRICES: Record<Duration, number> = {
  ONE_HOUR: 11000,
  TWO_HOURS: 20000,
  INTENSIVE: 38500,
  FULL_DAY: 50000,
};

describe("hasTokens", () => {
  it("detects a token", () => {
    expect(hasTokens("por {{FULL_DAY}} CHF")).toBe(true);
    expect(hasTokens("Season {{SEASON}}")).toBe(true);
  });
  it("is false for plain text or undefined", () => {
    expect(hasTokens("just words")).toBe(false);
    expect(hasTokens(undefined)).toBe(false);
  });
});

describe("interpolateTokens", () => {
  it("replaces per-lesson tokens with bare franc figures", () => {
    expect(interpolateTokens("{{ONE_HOUR}}", PRICES)).toBe("110");
    expect(interpolateTokens("{{TWO_HOURS}}", PRICES)).toBe("200");
    expect(interpolateTokens("{{INTENSIVE}}", PRICES)).toBe("385");
    expect(interpolateTokens("{{FULL_DAY}}", PRICES)).toBe("500");
  });

  it("computes derived per-hour and per-person tokens (rounded)", () => {
    expect(interpolateTokens("{{PER_HOUR_ONE_HOUR}}", PRICES)).toBe("110");
    expect(interpolateTokens("{{PER_HOUR_TWO_HOURS}}", PRICES)).toBe("100");
    expect(interpolateTokens("{{PER_HOUR_INTENSIVE}}", PRICES)).toBe("96"); // 385/4 = 96.25
    expect(interpolateTokens("{{PER_HOUR_FULL_DAY}}", PRICES)).toBe("83"); // 500/6 = 83.33
    expect(interpolateTokens("{{PER_PERSON_FULL_DAY}}", PRICES)).toBe("125"); // 500/4
  });

  it("resolves the SEASON fact token from its single source (no DB needed)", () => {
    expect(interpolateTokens("{{SEASON}}", null)).toBe(SEASON.label);
    expect(interpolateTokens("Saison {{SEASON}}", PRICES)).toBe(`Saison ${SEASON.label}`);
  });

  it("falls back to seeded prices when the DB read is null", () => {
    expect(interpolateTokens("{{FULL_DAY}}", null)).toBe(
      String(FALLBACK_PRICES.FULL_DAY / 100),
    );
  });

  it("leaves unknown tokens untouched (never breaks MDX with a stray token)", () => {
    expect(interpolateTokens("{{NOPE}}", PRICES)).toBe("{{NOPE}}");
  });

  it("replaces every occurrence in a sentence", () => {
    expect(
      interpolateTokens("desde {{ONE_HOUR}} CHF hasta {{FULL_DAY}} CHF", PRICES),
    ).toBe("desde 110 CHF hasta 500 CHF");
  });
});
