import { describe, expect, test, vi } from "vitest";
import { Duration } from "@prisma/client";

import {
  getActiveSeasonPricingWith,
  updateSeasonPricingWith,
  type AdminPricingDeps,
} from "./pricing";

type SeasonRow = {
  id: string;
  name: string;
  priceCentsByDuration: unknown;
} | null;

function makeDeps(season: SeasonRow) {
  const findFirst = vi.fn(async () => season);
  const update = vi.fn(async () => ({ id: season?.id ?? "season_x" }));
  const deps: AdminPricingDeps = {
    prisma: {
      season: { findFirst, update },
    } as unknown as AdminPricingDeps["prisma"],
  };
  return { deps, spies: { findFirst, update } };
}

const VALID = {
  ONE_HOUR: 11_000,
  TWO_HOURS: 20_000,
  INTENSIVE: 38_500,
  FULL_DAY: 50_000,
};

describe("updateSeasonPricingWith", () => {
  test("writes all four cents prices to the active season", async () => {
    const { deps, spies } = makeDeps({ id: "s1", name: "26/27", priceCentsByDuration: {} });
    const result = await updateSeasonPricingWith(deps, VALID);

    expect(result).toEqual({ ok: true });
    expect(spies.update).toHaveBeenCalledTimes(1);
    expect(spies.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { priceCentsByDuration: VALID },
    });
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

describe("getActiveSeasonPricingWith", () => {
  test("returns cents per duration for a fully-priced season", async () => {
    const { deps } = makeDeps({ id: "s1", name: "26/27", priceCentsByDuration: VALID });
    const result = await getActiveSeasonPricingWith(deps);

    expect(result).toEqual({
      ok: true,
      pricing: {
        seasonId: "s1",
        seasonName: "26/27",
        priceCentsByDuration: VALID,
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
      },
    });
  });

  test("returns NO_ACTIVE_SEASON when none is active", async () => {
    const { deps } = makeDeps(null);
    const result = await getActiveSeasonPricingWith(deps);
    expect(result).toEqual({ ok: false, error: "NO_ACTIVE_SEASON" });
  });
});
