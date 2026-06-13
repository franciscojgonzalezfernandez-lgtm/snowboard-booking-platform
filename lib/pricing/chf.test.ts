import { describe, expect, it } from "vitest";

import { centsToFrancs, francsToCents } from "./chf";

describe("francsToCents", () => {
  it("converts whole francs to cents", () => {
    expect(francsToCents(110)).toBe(11_000);
    expect(francsToCents(500)).toBe(50_000);
  });

  it("converts fractional francs to cents", () => {
    expect(francsToCents(110.5)).toBe(11_050);
    expect(francsToCents(38.5)).toBe(3_850);
  });

  it("rounds sub-cent input to the nearest cent (float safety)", () => {
    // 110.005 * 100 = 11000.499999… in IEEE-754; Math.round keeps it integer.
    expect(francsToCents(110.005)).toBe(11_001);
    expect(francsToCents(110.004)).toBe(11_000);
  });

  it("throws on non-finite input", () => {
    expect(() => francsToCents(Number.NaN)).toThrow();
    expect(() => francsToCents(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("centsToFrancs", () => {
  it("converts integer cents to franc decimals", () => {
    expect(centsToFrancs(11_000)).toBe(110);
    expect(centsToFrancs(3_850)).toBe(38.5);
  });

  it("throws on non-integer cents", () => {
    expect(() => centsToFrancs(11_000.5)).toThrow();
  });

  it("round-trips with francsToCents", () => {
    for (const cents of [11_000, 20_000, 38_500, 50_000, 12_345]) {
      expect(francsToCents(centsToFrancs(cents))).toBe(cents);
    }
  });
});
