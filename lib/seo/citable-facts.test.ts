import { describe, expect, it } from "vitest";

import { CITABLE_FACTS, FACTS_VERIFIED_ON, citableFact } from "@/lib/seo/citable-facts";
import { HOURS_BY_DURATION } from "@/lib/pricing/tiers";
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

  it("derives the full-day-hours fact from HOURS_BY_DURATION (no drift)", () => {
    expect(citableFact("full-day-hours").value).toBe(String(HOURS_BY_DURATION.FULL_DAY));
  });

  it("verified-on date is a valid ISO date", () => {
    expect(FACTS_VERIFIED_ON).toMatch(ISO_DATE);
  });

  it("citableFact throws on an unknown id", () => {
    // @ts-expect-error — id is a closed set; passing an unknown one is a type error.
    expect(() => citableFact("nope")).toThrow();
  });
});
