import { describe, it, expect } from "vitest";
import { Duration } from "@prisma/client";
import {
  PriceConfigurationError,
  assertSeasonPricesComplete,
  getPriceCents,
  getPromoLabel,
  getPromoLabelEntry,
  getPromoPriceCents,
  resolvePriceCents,
} from "./get-price";

const fullPriceMap = {
  ONE_HOUR: 11_000,
  TWO_HOURS: 20_000,
  INTENSIVE: 38_500,
  FULL_DAY: 50_000,
};

function makeSeason(priceCentsByDuration: unknown) {
  return { id: "season-test", priceCentsByDuration } as unknown as Parameters<
    typeof getPriceCents
  >[0];
}

describe("getPriceCents", () => {
  it("returns the cents value for every Duration", () => {
    const season = makeSeason(fullPriceMap);
    expect(getPriceCents(season, Duration.ONE_HOUR)).toBe(11_000);
    expect(getPriceCents(season, Duration.TWO_HOURS)).toBe(20_000);
    expect(getPriceCents(season, Duration.INTENSIVE)).toBe(38_500);
    expect(getPriceCents(season, Duration.FULL_DAY)).toBe(50_000);
  });

  it("throws PriceConfigurationError when the duration key is missing", () => {
    const season = makeSeason({ ONE_HOUR: 11_000, TWO_HOURS: 20_000 });
    expect(() => getPriceCents(season, Duration.INTENSIVE)).toThrow(PriceConfigurationError);
    expect(() => getPriceCents(season, Duration.INTENSIVE)).toThrow(/missing a price/);
  });

  it("throws when priceCentsByDuration is an empty object (post-migration default)", () => {
    const season = makeSeason({});
    expect(() => getPriceCents(season, Duration.ONE_HOUR)).toThrow(PriceConfigurationError);
  });

  it("throws when priceCentsByDuration is null", () => {
    const season = makeSeason(null);
    expect(() => getPriceCents(season, Duration.ONE_HOUR)).toThrow(/malformed/);
  });

  it("throws when a price is non-integer or negative", () => {
    const negative = makeSeason({ ...fullPriceMap, ONE_HOUR: -100 });
    expect(() => getPriceCents(negative, Duration.ONE_HOUR)).toThrow(/malformed/);

    const float = makeSeason({ ...fullPriceMap, ONE_HOUR: 110.5 });
    expect(() => getPriceCents(float, Duration.ONE_HOUR)).toThrow(/malformed/);
  });

  it("throws when priceCentsByDuration is not an object (string)", () => {
    const season = makeSeason("11000");
    expect(() => getPriceCents(season, Duration.ONE_HOUR)).toThrow(/malformed/);
  });

  it("throws when priceCentsByDuration is an array", () => {
    const season = makeSeason([11_000, 20_000]);
    expect(() => getPriceCents(season, Duration.ONE_HOUR)).toThrow(/malformed/);
  });
});

describe("assertSeasonPricesComplete", () => {
  it("passes when all four Duration keys are populated", () => {
    expect(() => assertSeasonPricesComplete(makeSeason(fullPriceMap))).not.toThrow();
  });

  it("throws when any Duration key is missing", () => {
    const partial = makeSeason({ ONE_HOUR: 11_000, TWO_HOURS: 20_000, INTENSIVE: 38_500 });
    expect(() => assertSeasonPricesComplete(partial)).toThrow(PriceConfigurationError);
  });
});

// --- F-141 promotional pricing ---------------------------------------------

function makePromoSeason(
  promoPrice: unknown,
  promoLabel: unknown = undefined,
  regular: unknown = fullPriceMap,
) {
  return {
    id: "season-promo",
    priceCentsByDuration: regular,
    promoPriceCentsByDuration: promoPrice,
    promoLabelByDuration: promoLabel,
  } as unknown as Parameters<typeof resolvePriceCents>[0] &
    Parameters<typeof getPromoLabel>[0];
}

describe("resolvePriceCents", () => {
  it("returns the regular price with isPromo=false when no promo is set", () => {
    const season = makePromoSeason(null);
    expect(resolvePriceCents(season, Duration.ONE_HOUR)).toEqual({
      cents: 11_000,
      originalCents: 11_000,
      isPromo: false,
    });
  });

  it("returns the promo price with the original when a valid promo applies", () => {
    const season = makePromoSeason({ ONE_HOUR: 9_500 });
    expect(resolvePriceCents(season, Duration.ONE_HOUR)).toEqual({
      cents: 9_500,
      originalCents: 11_000,
      isPromo: true,
    });
    // A duration without a promo entry stays at the regular price.
    expect(resolvePriceCents(season, Duration.TWO_HOURS)).toEqual({
      cents: 20_000,
      originalCents: 20_000,
      isPromo: false,
    });
  });

  it("ignores a promo that is not strictly below the regular price", () => {
    expect(
      resolvePriceCents(makePromoSeason({ ONE_HOUR: 11_000 }), Duration.ONE_HOUR),
    ).toMatchObject({ cents: 11_000, isPromo: false });
    expect(
      resolvePriceCents(makePromoSeason({ ONE_HOUR: 12_000 }), Duration.ONE_HOUR),
    ).toMatchObject({ cents: 11_000, isPromo: false });
  });

  it("ignores a non-positive, non-integer, or malformed promo", () => {
    for (const bad of [0, -100, 90.5, "9500", null]) {
      expect(
        resolvePriceCents(makePromoSeason({ ONE_HOUR: bad }), Duration.ONE_HOUR),
      ).toMatchObject({ cents: 11_000, isPromo: false });
    }
    // Whole promo map malformed → regular stands.
    expect(
      resolvePriceCents(makePromoSeason("nope"), Duration.ONE_HOUR),
    ).toMatchObject({ cents: 11_000, isPromo: false });
  });

  it("still throws when the REGULAR price is missing/malformed", () => {
    expect(() =>
      resolvePriceCents(makePromoSeason({ ONE_HOUR: 9_500 }, undefined, {}), Duration.ONE_HOUR),
    ).toThrow(PriceConfigurationError);
  });
});

describe("getPromoPriceCents", () => {
  it("returns the stored promo price, or null when absent/invalid", () => {
    const season = makePromoSeason({ ONE_HOUR: 9_500, TWO_HOURS: 0 });
    expect(getPromoPriceCents(season, Duration.ONE_HOUR)).toBe(9_500);
    expect(getPromoPriceCents(season, Duration.TWO_HOURS)).toBeNull();
    expect(getPromoPriceCents(season, Duration.INTENSIVE)).toBeNull();
  });
});

describe("getPromoLabel / getPromoLabelEntry", () => {
  const season = makePromoSeason(
    { ONE_HOUR: 9_500 },
    { ONE_HOUR: { en: "Season opening", de: "Saisonstart", es: "Apertura" } },
  );

  it("returns the copy for the requested locale", () => {
    expect(getPromoLabel(season, Duration.ONE_HOUR, "de")).toBe("Saisonstart");
    expect(getPromoLabel(season, Duration.ONE_HOUR, "es")).toBe("Apertura");
  });

  it("falls back to English when the locale entry is empty", () => {
    const partial = makePromoSeason(
      { ONE_HOUR: 9_500 },
      { ONE_HOUR: { en: "Season opening", de: "   ", es: "" } },
    );
    expect(getPromoLabel(partial, Duration.ONE_HOUR, "de")).toBe("Season opening");
  });

  it("returns null for a duration with no promo label", () => {
    expect(getPromoLabel(season, Duration.TWO_HOURS, "en")).toBeNull();
    expect(getPromoLabelEntry(season, Duration.TWO_HOURS)).toBeNull();
  });

  it("getPromoLabelEntry returns the full localized object", () => {
    expect(getPromoLabelEntry(season, Duration.ONE_HOUR)).toEqual({
      en: "Season opening",
      de: "Saisonstart",
      es: "Apertura",
    });
  });
});
