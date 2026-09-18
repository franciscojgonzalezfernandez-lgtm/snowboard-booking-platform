import { describe, expect, it } from "vitest";

import {
  CITABLE_FACTS,
  FACTS_VERIFIED_ON,
  citableFact,
  datedPriceRange,
} from "@/lib/seo/citable-facts";
import { LANGUAGES, SEASON } from "@/lib/seo/business";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("CITABLE_FACTS", () => {
  it("every fact is dated, sourced and non-empty (the citability contract)", () => {
    expect(CITABLE_FACTS.length).toBeGreaterThan(0);
    for (const fact of CITABLE_FACTS) {
      expect(fact.value, `${fact.id} value`).not.toBe("");
      expect(fact.asOf, `${fact.id} asOf`).toMatch(ISO_DATE);
      expect(fact.source.startsWith("/"), `${fact.id} source is a path`).toBe(true);
      expect(fact.answers, `${fact.id} answers`).not.toBe("");
    }
  });

  it("has unique ids", () => {
    const ids = CITABLE_FACTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the languages fact in lockstep with LANGUAGES (no drift)", () => {
    expect(citableFact("languages").value).toBe(LANGUAGES.join(","));
  });

  it("derives the season-window fact from SEASON (no drift)", () => {
    expect(citableFact("season-window").value).toBe(`${SEASON.startDate}/${SEASON.endDate}`);
  });

  it("verified-on date is a valid ISO date", () => {
    expect(FACTS_VERIFIED_ON).toMatch(ISO_DATE);
  });

  it("citableFact throws on an unknown id", () => {
    // @ts-expect-error — id is a closed set; passing an unknown one is a type error.
    expect(() => citableFact("nope")).toThrow();
  });
});

describe("datedPriceRange", () => {
  it("frames DB cents as a dated, sourced CHF range tied to the season", () => {
    const range = datedPriceRange(11000, 50000);
    expect(range.min).toContain("110");
    expect(range.max).toContain("500");
    expect(range.season).toBe(SEASON.label);
    expect(range.priceValidUntil).toBe(SEASON.priceValidUntil);
    expect(range.source).toBe("/precios");
  });

  it("rejects an inverted range", () => {
    expect(() => datedPriceRange(50000, 11000)).toThrow();
  });

  it("rejects non-integer cents (delegates to formatChf)", () => {
    expect(() => datedPriceRange(110.5, 50000)).toThrow();
  });
});
