import { describe, expect, test, vi } from "vitest";

import {
  activateSeasonWith,
  createSeasonWith,
  deactivateSeasonWith,
  listSeasonsWith,
  updateSeasonWith,
  type AdminSeasonsDeps,
} from "./seasons";

const COMPLETE_PRICING = {
  ONE_HOUR: 11_000,
  TWO_HOURS: 20_000,
  INTENSIVE: 38_500,
  FULL_DAY: 50_000,
};

const VALID_INPUT = {
  name: "Season 27/28",
  startDate: "2027-12-01",
  endDate: "2028-03-31",
  anchorTimes: ["09:00", "11:00", "13:00"],
  operatingHoursStart: "09:00",
  operatingHoursEnd: "16:00",
};

type SeasonRow = {
  id: string;
  priceCentsByDuration?: unknown;
  startDate?: Date;
  endDate?: Date;
} | null;

type BookingRow = { date: Date; anchorTime: string };

function makeDeps(opts?: {
  findUnique?: SeasonRow;
  bookings?: BookingRow[];
  findMany?: unknown[];
}) {
  const findMany = vi.fn(async () => opts?.findMany ?? []);
  const findUnique = vi.fn(async () => opts?.findUnique ?? null);
  const create =
    vi.fn<(args: { data: Record<string, unknown> }) => Promise<{ id: string }>>(
      async () => ({ id: "new_season" }),
    );
  const update =
    vi.fn<(args: { where: unknown; data: unknown }) => Promise<{ id: string }>>(
      async () => ({ id: "s1" }),
    );
  const updateMany =
    vi.fn<(args: { where: unknown; data: unknown }) => Promise<{ count: number }>>(
      async () => ({ count: 1 }),
    );
  const bookingFindMany = vi.fn(async () => opts?.bookings ?? []);
  const $transaction = vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops));

  const deps: AdminSeasonsDeps = {
    prisma: {
      season: { findMany, findUnique, create, update, updateMany },
      booking: { findMany: bookingFindMany },
      $transaction,
    } as unknown as AdminSeasonsDeps["prisma"],
  };
  return {
    deps,
    spies: { findMany, findUnique, create, update, updateMany, bookingFindMany, $transaction },
  };
}

describe("createSeasonWith", () => {
  test("creates an inactive season and returns its id", async () => {
    const { deps, spies } = makeDeps();
    const result = await createSeasonWith(deps, VALID_INPUT);

    expect(result).toEqual({ ok: true, id: "new_season" });
    expect(spies.create).toHaveBeenCalledTimes(1);
    const arg = spies.create.mock.calls[0]![0];
    expect(arg.data.active).toBe(false);
    // anchorTimes sorted/deduped by the schema transform.
    expect(arg.data.anchorTimes).toEqual(["09:00", "11:00", "13:00"]);
    expect(arg.data.startDate).toEqual(new Date("2027-12-01T00:00:00.000Z"));
  });

  test("ignores a client-sent active:true (activation is gated)", async () => {
    const { deps, spies } = makeDeps();
    await createSeasonWith(deps, { ...VALID_INPUT, active: true });
    const arg = spies.create.mock.calls[0]![0];
    expect(arg.data.active).toBe(false);
  });

  test("dedups + sorts anchors", async () => {
    const { deps, spies } = makeDeps();
    await createSeasonWith(deps, {
      ...VALID_INPUT,
      anchorTimes: ["13:00", "09:00", "09:00", "11:00"],
    });
    const arg = spies.create.mock.calls[0]![0];
    expect(arg.data.anchorTimes).toEqual(["09:00", "11:00", "13:00"]);
  });

  test("rejects start >= end", async () => {
    const { deps, spies } = makeDeps();
    const result = await createSeasonWith(deps, {
      ...VALID_INPUT,
      startDate: "2028-03-31",
      endDate: "2027-12-01",
    });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(spies.create).not.toHaveBeenCalled();
  });

  test("rejects an anchor outside operating hours", async () => {
    const { deps } = makeDeps();
    const result = await createSeasonWith(deps, {
      ...VALID_INPUT,
      anchorTimes: ["08:00"], // before opStart 09:00
    });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("rejects inverted operating hours", async () => {
    const { deps } = makeDeps();
    const result = await createSeasonWith(deps, {
      ...VALID_INPUT,
      operatingHoursStart: "16:00",
      operatingHoursEnd: "09:00",
    });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("rejects an empty anchor list", async () => {
    const { deps } = makeDeps();
    const result = await createSeasonWith(deps, { ...VALID_INPUT, anchorTimes: [] });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });
});

describe("activateSeasonWith", () => {
  test("deactivates every other season and activates the target (single active)", async () => {
    const { deps, spies } = makeDeps({
      findUnique: { id: "s1", priceCentsByDuration: COMPLETE_PRICING },
    });
    const result = await activateSeasonWith(deps, "s1");

    expect(result).toEqual({ ok: true });
    expect(spies.$transaction).toHaveBeenCalledTimes(1);
    expect(spies.updateMany).toHaveBeenCalledWith({
      where: { id: { not: "s1" } },
      data: { active: false },
    });
    expect(spies.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { active: true },
    });
  });

  test("rejects activation when pricing is incomplete", async () => {
    const { deps, spies } = makeDeps({
      findUnique: {
        id: "s1",
        priceCentsByDuration: { ONE_HOUR: 11_000 }, // missing 3 keys
      },
    });
    const result = await activateSeasonWith(deps, "s1");
    expect(result).toEqual({ ok: false, error: "INCOMPLETE_PRICING" });
    expect(spies.$transaction).not.toHaveBeenCalled();
  });

  test("404s an unknown season", async () => {
    const { deps } = makeDeps({ findUnique: null });
    const result = await activateSeasonWith(deps, "nope");
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});

describe("updateSeasonWith", () => {
  const existing = {
    id: "s1",
    startDate: new Date("2027-12-01T00:00:00.000Z"),
    endDate: new Date("2028-03-31T00:00:00.000Z"),
  };

  test("rejects narrowing dates that orphan a live booking", async () => {
    const { deps, spies } = makeDeps({
      findUnique: existing,
      bookings: [{ date: new Date("2028-03-15T00:00:00.000Z"), anchorTime: "09:00" }],
    });
    const result = await updateSeasonWith(deps, "s1", {
      ...VALID_INPUT,
      endDate: "2028-02-28", // drops the 03-15 booking
    });
    expect(result).toEqual({ ok: false, error: "HAS_BOOKINGS_OUT_OF_RANGE" });
    expect(spies.update).not.toHaveBeenCalled();
  });

  test("rejects dropping an anchor a live booking sits on", async () => {
    const { deps, spies } = makeDeps({
      findUnique: existing,
      bookings: [{ date: new Date("2028-01-10T00:00:00.000Z"), anchorTime: "15:00" }],
    });
    const result = await updateSeasonWith(deps, "s1", {
      ...VALID_INPUT,
      anchorTimes: ["09:00", "11:00"], // no 15:00
    });
    expect(result).toEqual({ ok: false, error: "HAS_BOOKINGS_OUT_OF_RANGE" });
    expect(spies.update).not.toHaveBeenCalled();
  });

  test("updates when no live booking is orphaned", async () => {
    const { deps, spies } = makeDeps({
      findUnique: existing,
      bookings: [{ date: new Date("2028-01-10T00:00:00.000Z"), anchorTime: "09:00" }],
    });
    const result = await updateSeasonWith(deps, "s1", VALID_INPUT);
    expect(result).toEqual({ ok: true });
    expect(spies.update).toHaveBeenCalledTimes(1);
  });

  test("404s an unknown season", async () => {
    const { deps } = makeDeps({ findUnique: null });
    const result = await updateSeasonWith(deps, "nope", VALID_INPUT);
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  test("rejects invalid input before touching the DB", async () => {
    const { deps, spies } = makeDeps({ findUnique: existing });
    const result = await updateSeasonWith(deps, "s1", {
      ...VALID_INPUT,
      startDate: "2028-03-31",
      endDate: "2027-12-01",
    });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(spies.findUnique).not.toHaveBeenCalled();
  });
});

describe("deactivateSeasonWith", () => {
  test("sets the season inactive (zero active allowed)", async () => {
    const { deps, spies } = makeDeps({ findUnique: { id: "s1" } });
    const result = await deactivateSeasonWith(deps, "s1");
    expect(result).toEqual({ ok: true });
    expect(spies.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { active: false },
    });
  });

  test("404s an unknown season", async () => {
    const { deps } = makeDeps({ findUnique: null });
    const result = await deactivateSeasonWith(deps, "nope");
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});

describe("listSeasonsWith", () => {
  test("maps rows, formats dates, and flags pricing completeness", async () => {
    const { deps } = makeDeps({
      findMany: [
        {
          id: "s1",
          name: "26/27",
          startDate: new Date("2026-12-01T00:00:00.000Z"),
          endDate: new Date("2027-03-31T00:00:00.000Z"),
          active: true,
          anchorTimes: ["09:00", "11:00"],
          operatingHoursStart: "09:00",
          operatingHoursEnd: "16:00",
          priceCentsByDuration: COMPLETE_PRICING,
        },
        {
          id: "s2",
          name: "27/28",
          startDate: new Date("2027-12-01T00:00:00.000Z"),
          endDate: new Date("2028-03-31T00:00:00.000Z"),
          active: false,
          anchorTimes: ["10:00"],
          operatingHoursStart: "09:00",
          operatingHoursEnd: "16:00",
          priceCentsByDuration: {}, // incomplete
        },
      ],
    });
    const rows = await listSeasonsWith(deps);
    expect(rows[0]).toMatchObject({
      id: "s1",
      startDate: "2026-12-01",
      endDate: "2027-03-31",
      active: true,
      pricingComplete: true,
    });
    expect(rows[1]).toMatchObject({ id: "s2", pricingComplete: false });
  });
});
