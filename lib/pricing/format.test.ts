import { describe, it, expect } from "vitest";
import { formatChf } from "./format";

describe("formatChf", () => {
  it("formats integer cents as CHF with Swiss German conventions", () => {
    expect(formatChf(11_000)).toMatch(/CHF/);
    expect(formatChf(11_000)).toMatch(/110/);
    expect(formatChf(38_500)).toMatch(/385/);
  });

  it("handles zero", () => {
    expect(formatChf(0)).toMatch(/CHF/);
    expect(formatChf(0)).toMatch(/0/);
  });

  it("throws on non-integer input", () => {
    expect(() => formatChf(110.5)).toThrow(/integer cents/);
  });

  it("throws on non-finite input", () => {
    expect(() => formatChf(Number.NaN)).toThrow(/integer cents/);
    expect(() => formatChf(Number.POSITIVE_INFINITY)).toThrow(/integer cents/);
  });
});
