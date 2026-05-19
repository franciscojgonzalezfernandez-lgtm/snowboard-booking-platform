import { describe, it, expect } from "vitest";
import { Duration } from "@prisma/client";
import {
  PriceConfigurationError,
  assertSeasonPricesComplete,
  getPriceCents,
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
