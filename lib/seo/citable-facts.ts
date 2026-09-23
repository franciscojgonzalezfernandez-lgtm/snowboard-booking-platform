import { formatChf } from "@/lib/pricing/format";
import { LANGUAGES, SEASON } from "@/lib/seo/business";

// F-147 — On-site authority. Autoridad = the lowest GenScore metric (15/100):
// answer engines name Ride Flumserberg but lean on OTHER sites as the cited
// source. To be cited, a page has to carry concrete facts that are dated and
// attributable to us. This module is the single source of those facts — the
// structured VALUES only, locale-independent — so the trilingual pages built in
// F-145/F-146 render their own copy around them without any number or date
// drifting between locales, the visible text and the Schema.org output.
//
// Deliberately NOT here: prices. Prices live in the DB (Season.priceCentsByDuration,
// F-080) and must not be re-hardcoded; pages pass their DB figures through
// {@link datedPriceRange} to get the same dated, sourced framing.

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
    // Full-day lesson = 6 hours on snow (matches WORKLOAD_BY_DURATION.FULL_DAY).
    value: "6",
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

/**
 * Frame a DB-sourced price range as a dated, attributable fact (F-147). Pages
 * pass their `Season.priceCentsByDuration` figures — never a hardcoded number —
 * and get back the CHF range plus the season label + validity date, so the
 * visible "as of the 2026/27 season" line, the copy and the `Offer.priceValidUntil`
 * all quote the same window. Cents are validated by {@link formatChf}.
 */
export function datedPriceRange(minCents: number, maxCents: number) {
  if (maxCents < minCents) {
    throw new Error(`datedPriceRange: maxCents (${maxCents}) < minCents (${minCents})`);
  }
  return {
    min: formatChf(minCents),
    max: formatChf(maxCents),
    season: SEASON.label,
    priceValidUntil: SEASON.priceValidUntil,
    source: "/precios",
  } as const;
}
