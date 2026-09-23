import { describe, expect, test, vi } from "vitest";
import { Duration, Prisma } from "@prisma/client";

import {
  activeSeasonHasPromo,
  getActiveSeasonPricingWith,
  updateSeasonPricingWith,
  type AdminPricingDeps,
} from "./pricing";

type SeasonRow = {
  id: string;
  name: string;
  priceCentsByDuration: unknown;
  promoPriceCentsByDuration?: unknown;
  promoLabelByDuration?: unknown;
} | null;

function makeDeps(season: SeasonRow, enabledBanners = 0) {
  const findFirst = vi.fn(async () => season);
  const update = vi.fn(async () => ({ id: season?.id ?? "season_x" }));
  const count = vi.fn(async () => enabledBanners);
  const deps: AdminPricingDeps = {
    prisma: {
      season: { findFirst, update },
      adBanner: { count },
    } as unknown as AdminPricingDeps["prisma"],
  };
  return { deps, spies: { findFirst, update, count } };
}

const VALID = {
  ONE_HOUR: 11_000,
  TWO_HOURS: 20_000,
  INTENSIVE: 38_500,
  FULL_DAY: 50_000,
};

const LABEL = { en: "Season opening", de: "Saisonstart", es: "Apertura" };

describe("updateSeasonPricingWith", () => {
  test("writes the four cents prices, promo columns NULL when no promo", async () => {
    const { deps, spies } = makeDeps({ id: "s1", name: "26/27", priceCentsByDuration: {} });
    const result = await updateSeasonPricingWith(deps, VALID);

    expect(result).toEqual({ ok: true });
    expect(spies.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: {
        priceCentsByDuration: VALID,
        promoPriceCentsByDuration: Prisma.DbNull,
        promoLabelByDuration: Prisma.DbNull,
      },
    });
    // No promo → no banner check.
    expect(spies.count).not.toHaveBeenCalled();
  });

  test("writes a partial promo map + labels when a promo is set (banner present)", async () => {
    const { deps, spies } = makeDeps(
      { id: "s1", name: "26/27", priceCentsByDuration: {} },
      1,
    );
    const result = await updateSeasonPricingWith(deps, {
      ...VALID,
      promos: { ONE_HOUR: { priceCents: 9_500, label: LABEL } },
    });

    expect(result).toEqual({ ok: true });
    expect(spies.count).toHaveBeenCalledWith({ where: { enabled: true } });
    expect(spies.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: {
        priceCentsByDuration: VALID,
        promoPriceCentsByDuration: { ONE_HOUR: 9_500 },
        promoLabelByDuration: { ONE_HOUR: LABEL },
      },
    });
  });

  test("blocks a promo with no enabled banner (PROMO_REQUIRES_BANNER)", async () => {
    const { deps, spies } = makeDeps(
      { id: "s1", name: "26/27", priceCentsByDuration: {} },
      0,
    );
    const result = await updateSeasonPricingWith(deps, {
      ...VALID,
      promos: { ONE_HOUR: { priceCents: 9_500, label: LABEL } },
    });

    expect(result).toEqual({ ok: false, error: "PROMO_REQUIRES_BANNER" });
    expect(spies.update).not.toHaveBeenCalled();
  });

  test("rejects a promo that is not below the regular price", async () => {
    const { deps, spies } = makeDeps(
      { id: "s1", name: "26/27", priceCentsByDuration: {} },
      1,
    );
    const result = await updateSeasonPricingWith(deps, {
      ...VALID,
      promos: { ONE_HOUR: { priceCents: 11_000, label: LABEL } },
    });

    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(spies.update).not.toHaveBeenCalled();
  });

  test("rejects a promo missing a locale label", async () => {
    const { deps } = makeDeps({ id: "s1", name: "26/27", priceCentsByDuration: {} }, 1);
    const result = await updateSeasonPricingWith(deps, {
      ...VALID,
      promos: {
        ONE_HOUR: { priceCents: 9_500, label: { en: "x", de: "", es: "y" } },
      },
    });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("rejects a negative price without touching the DB", async () => {
    const { deps, spies } = makeDeps({ id: "s1", name: "26/27", priceCentsByDuration: {} });
    const result = await updateSeasonPricingWith(deps, { ...VALID, ONE_HOUR: -1 });

    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(spies.update).not.toHaveBeenCalled();
  });

  test("rejects a zero price", async () => {
    const { deps } = makeDeps({ id: "s1", name: "26/27", priceCentsByDuration: {} });
    const result = await updateSeasonPricingWith(deps, { ...VALID, TWO_HOURS: 0 });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("rejects a non-integer (fractional cents) price", async () => {
    const { deps, spies } = makeDeps({ id: "s1", name: "26/27", priceCentsByDuration: {} });
    const result = await updateSeasonPricingWith(deps, { ...VALID, INTENSIVE: 38_500.5 });

    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(spies.update).not.toHaveBeenCalled();
  });

  test("rejects an over-ceiling price", async () => {
    const { deps } = makeDeps({ id: "s1", name: "26/27", priceCentsByDuration: {} });
    const result = await updateSeasonPricingWith(deps, { ...VALID, FULL_DAY: 1_000_001 });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("rejects a missing key", async () => {
    const { deps } = makeDeps({ id: "s1", name: "26/27", priceCentsByDuration: {} });
    const { ONE_HOUR: _omit, ...partial } = VALID;
    void _omit;
    const result = await updateSeasonPricingWith(
      deps,
      partial as unknown as typeof VALID,
    );
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("returns NO_ACTIVE_SEASON when none is active", async () => {
    const { deps, spies } = makeDeps(null);
    const result = await updateSeasonPricingWith(deps, VALID);

    expect(result).toEqual({ ok: false, error: "NO_ACTIVE_SEASON" });
    expect(spies.update).not.toHaveBeenCalled();
  });
});

describe("activeSeasonHasPromo", () => {
  test("true when the active season has a valid promo", async () => {
    const { deps } = makeDeps({
      id: "s1",
      name: "26/27",
      priceCentsByDuration: VALID,
      promoPriceCentsByDuration: { ONE_HOUR: 9_500 },
    });
    expect(await activeSeasonHasPromo(deps)).toBe(true);
  });

  test("false when there is no promo or no active season", async () => {
    const { deps: none } = makeDeps({
      id: "s1",
      name: "26/27",
      priceCentsByDuration: VALID,
      promoPriceCentsByDuration: null,
    });
    expect(await activeSeasonHasPromo(none)).toBe(false);
    const { deps: noSeason } = makeDeps(null);
    expect(await activeSeasonHasPromo(noSeason)).toBe(false);
  });
});

describe("getActiveSeasonPricingWith", () => {
  test("returns cents + promo per duration for a fully-priced season", async () => {
    const { deps } = makeDeps({
      id: "s1",
      name: "26/27",
      priceCentsByDuration: VALID,
      promoPriceCentsByDuration: { ONE_HOUR: 9_500 },
      promoLabelByDuration: { ONE_HOUR: LABEL },
    });
    const result = await getActiveSeasonPricingWith(deps);

    expect(result).toEqual({
      ok: true,
      pricing: {
        seasonId: "s1",
        seasonName: "26/27",
        priceCentsByDuration: VALID,
        promoByDuration: {
          [Duration.ONE_HOUR]: { priceCents: 9_500, label: LABEL },
          [Duration.TWO_HOURS]: null,
          [Duration.INTENSIVE]: null,
          [Duration.FULL_DAY]: null,
        },
      },
    });
  });

  test("maps missing keys to null (freshly-migrated empty map)", async () => {
    const { deps } = makeDeps({ id: "s1", name: "26/27", priceCentsByDuration: {} });
    const result = await getActiveSeasonPricingWith(deps);

    expect(result).toEqual({
      ok: true,
      pricing: {
        seasonId: "s1",
        seasonName: "26/27",
        priceCentsByDuration: {
          [Duration.ONE_HOUR]: null,
          [Duration.TWO_HOURS]: null,
          [Duration.INTENSIVE]: null,
          [Duration.FULL_DAY]: null,
        },
        promoByDuration: {
          [Duration.ONE_HOUR]: null,
          [Duration.TWO_HOURS]: null,
          [Duration.INTENSIVE]: null,
          [Duration.FULL_DAY]: null,
        },
      },
    });
  });

  test("returns NO_ACTIVE_SEASON when none is active", async () => {
    const { deps } = makeDeps(null);
    const result = await getActiveSeasonPricingWith(deps);
    expect(result).toEqual({ ok: false, error: "NO_ACTIVE_SEASON" });
  });
});
