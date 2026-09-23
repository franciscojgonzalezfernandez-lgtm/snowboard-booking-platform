import { Duration } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { FALLBACK_PRICES, hasPriceTokens, interpolatePrices } from "./prices";

const PRICES: Record<Duration, number> = {
  ONE_HOUR: 11000,
  TWO_HOURS: 20000,
  INTENSIVE: 38500,
  FULL_DAY: 50000,
};

describe("hasPriceTokens", () => {
  it("detects a token", () => {
    expect(hasPriceTokens("por {{FULL_DAY}} CHF")).toBe(true);
  });
  it("is false for plain text or undefined", () => {
    expect(hasPriceTokens("just words")).toBe(false);
    expect(hasPriceTokens(undefined)).toBe(false);
  });
});

describe("interpolatePrices", () => {
  it("replaces per-lesson tokens with bare franc figures", () => {
    expect(interpolatePrices("{{ONE_HOUR}}", PRICES)).toBe("110");
    expect(interpolatePrices("{{TWO_HOURS}}", PRICES)).toBe("200");
    expect(interpolatePrices("{{INTENSIVE}}", PRICES)).toBe("385");
    expect(interpolatePrices("{{FULL_DAY}}", PRICES)).toBe("500");
  });

  it("computes derived per-hour and per-person tokens (rounded)", () => {
    expect(interpolatePrices("{{PER_HOUR_ONE_HOUR}}", PRICES)).toBe("110");
    expect(interpolatePrices("{{PER_HOUR_TWO_HOURS}}", PRICES)).toBe("100");
    expect(interpolatePrices("{{PER_HOUR_INTENSIVE}}", PRICES)).toBe("96"); // 385/4 = 96.25
    expect(interpolatePrices("{{PER_HOUR_FULL_DAY}}", PRICES)).toBe("83"); // 500/6 = 83.33
    expect(interpolatePrices("{{PER_PERSON_FULL_DAY}}", PRICES)).toBe("125"); // 500/4
  });

  it("falls back to seeded prices when the DB read is null", () => {
    expect(interpolatePrices("{{FULL_DAY}}", null)).toBe(
      String(FALLBACK_PRICES.FULL_DAY / 100),
    );
  });

  it("leaves unknown tokens untouched (never breaks MDX with a stray token)", () => {
    expect(interpolatePrices("{{NOPE}}", PRICES)).toBe("{{NOPE}}");
  });

  it("replaces every occurrence in a sentence", () => {
    expect(
      interpolatePrices("desde {{ONE_HOUR}} CHF hasta {{FULL_DAY}} CHF", PRICES),
    ).toBe("desde 110 CHF hasta 500 CHF");
  });
});
