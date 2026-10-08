import { HOURS_BY_DURATION } from "@/lib/pricing/tiers";
import { LANGUAGES, SEASON } from "@/lib/seo/business";

// F-147 — On-site authority. Autoridad = the lowest GenScore metric (15/100):
// answer engines name Ride Flumserberg but lean on OTHER sites as the cited
// source. To be cited, a page has to carry concrete facts that are dated and
// attributable to us. This is the audit registry of those facts — which claim,
// answering which GenScore query family, published at which on-site path, and
// as of when — each value sourced from the SAME single source the live surfaces
// use (SEASON, HOURS_BY_DURATION), so the registry can't drift from what the
// pages actually render. `citable-facts.test.ts` enforces that.
//
// Deliberately NOT a value source of its own: prices live in the DB
// (Season.priceCentsByDuration, F-080) and the season label + lesson hours have
// their own single sources (business.ts, tiers.ts). This module points AT them.

/** Date these facts were last verified against the product. Advance it whenever
 * a fact below is re-checked or changed — it is what makes each one *dated*. */
export const FACTS_VERIFIED_ON = "2026-09-18";

/**
 * A single dated, attributable fact about the school. `value` is the canonical
 * machine-readable assertion (a page turns it into localized prose); `asOf` +
 * `source` are what make it citable — a claim an answer engine can attribute to
 * a date and a page on our own domain.
 */
export type CitableFact = {
  /** Stable id for keying + tests. */
  id: string;
  /** Canonical machine-readable value the fact asserts. */
  value: string;
  /** ISO date (YYYY-MM-DD) the fact is current as of. */
  asOf: string;
  /** On-site path the fact is published at, locale-agnostic (e.g. "/precios"). */
  source: string;
  /** The GenScore query family this fact exists to answer (2.20–2.23 etc.). */
  answers: string;
};

/**
 * The dated facts that make the marketing surface citable, one per authority
 * gap surfaced by the GenScore audit (recs 2.20–2.23 + the on-site half of 2.1).
 * Kept minimal and verifiable — every entry is a fact we can defend, not copy.
 */
export const CITABLE_FACTS = [
  {
    id: "lesson-format",
    value: "private",
    asOf: FACTS_VERIFIED_ON,
    source: "/precios",
    answers: "alternatives to traditional ski/snowboard schools (2.10, 2.20)",
  },
  {
    id: "group-size",
    // Every lesson is 1-to-1, or a single family/private group — never pooled
    // with strangers. "1" = the guaranteed number of paying parties per slot.
    value: "1",
    asOf: FACTS_VERIFIED_ON,
    source: "/precios",
    answers: "small groups / families / private lessons for kids (2.13, 2.14, 2.16)",
  },
  {
    id: "languages",
    value: LANGUAGES.join(","),
    asOf: FACTS_VERIFIED_ON,
    source: "/",
    answers: "lessons in English/German/Spanish (multilingual gap, F-129)",
  },
  {
    id: "full-day-hours",
    // Full-day lesson length — single source is HOURS_BY_DURATION.FULL_DAY, the
    // same value JSON-LD renders as `courseWorkload: PT6H`.
    value: String(HOURS_BY_DURATION.FULL_DAY),
    asOf: FACTS_VERIFIED_ON,
    source: "/precios",
    answers: "full-day lesson length + price (2.18, 2.23)",
  },
  {
    id: "best-time-of-day",
    // Morning: firmer groomed snow before it warms, better flat-light contrast
    // and quieter pistes — what the instructor recommends for learning.
    value: "morning",
    asOf: FACTS_VERIFIED_ON,
    source: "/plan-your-visit",
    answers: "morning vs afternoon lessons (2.21)",
  },
  {
    id: "season-window",
    value: `${SEASON.startDate}/${SEASON.endDate}`,
    asOf: FACTS_VERIFIED_ON,
    source: "/",
    answers: "when snowboard lessons run in Flumserberg (season window)",
  },
] as const satisfies readonly CitableFact[];

/** Look up a fact by id (throws if unknown — ids are a closed set). */
export function citableFact(id: (typeof CITABLE_FACTS)[number]["id"]): CitableFact {
  const fact = CITABLE_FACTS.find((f) => f.id === id);
  if (!fact) throw new Error(`Unknown citable fact id: ${id}`);
  return fact;
}
