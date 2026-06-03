import { describe, expect, test, vi } from "vitest";
import { AvailabilityKind, BookingStatus, Duration } from "@prisma/client";

import {
  blockAvailabilityWindowWith,
  clearAvailabilityWith,
  openAvailabilityRangeWith,
  type AvailabilityDeps,
} from "./availability-actions";

const SEASON = {
  id: "season_1",
  operatingHoursStart: "08:00",
  operatingHoursEnd: "17:00",
};

function makeDeps(overrides?: {
  season?: typeof SEASON | null;
  existingOpen?: Array<{ startDateTime: Date }>;
  block?: {
    id: string;
    instructorId: string;
    startDateTime: Date;
    endDateTime: Date;
  } | null;
  bookings?: Array<{
    id: string;
    date: Date;
    anchorTime: string;
    duration: Duration;
    status: BookingStatus;
  }>;
}) {
  const createMany = vi.fn(async (args: { data: unknown[] }) => ({
    count: args.data.length,
  }));
  const create = vi.fn(async () => ({ id: "new_block" }));
  const del = vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id }));

  const deps: AvailabilityDeps = {
    instructorId: "inst_1",
    prisma: {
      season: {
        findFirst: vi.fn(async () =>
          overrides?.season === undefined ? SEASON : overrides.season,
        ),
      },
      availabilityBlock: {
        findMany: vi.fn(async () => overrides?.existingOpen ?? []),
        findUnique: vi.fn(async () =>
          overrides?.block === undefined ? null : overrides.block,
        ),
        createMany,
        create,
        delete: del,
      },
      booking: {
        findMany: vi.fn(async () => overrides?.bookings ?? []),
      },
    } as unknown as AvailabilityDeps["prisma"],
  };
  return { deps, spies: { createMany, create, del } };
}

describe("openAvailabilityRangeWith", () => {
  test("creates one AVAILABLE block per day in the range", async () => {
    const { deps, spies } = makeDeps();
    const result = await openAvailabilityRangeWith(deps, {
      fromDate: "2026-12-20",
      toDate: "2026-12-22",
    });
    expect(result).toEqual({ ok: true, created: 3 });
    const [{ data }] = spies.createMany.mock.calls[0] as [{ data: unknown[] }];
    expect(data).toHaveLength(3);
    expect((data[0] as { kind: AvailabilityKind }).kind).toBe(AvailabilityKind.AVAILABLE);
  });

  test("idempotent: skips days already open", async () => {
    const { deps } = makeDeps({
      existingOpen: [{ startDateTime: new Date("2026-12-21T08:00:00.000Z") }],
    });
    const result = await openAvailabilityRangeWith(deps, {
      fromDate: "2026-12-20",
      toDate: "2026-12-22",
    });
    expect(result).toEqual({ ok: true, created: 2 });
  });

  test("created: 0 when the whole range is already open (no createMany)", async () => {
    const { deps, spies } = makeDeps({
      existingOpen: [{ startDateTime: new Date("2026-12-20T08:00:00.000Z") }],
    });
    const result = await openAvailabilityRangeWith(deps, {
      fromDate: "2026-12-20",
      toDate: "2026-12-20",
    });
    expect(result).toEqual({ ok: true, created: 0 });
    expect(spies.createMany).not.toHaveBeenCalled();
  });

  test("INVALID_RANGE when fromDate > toDate", async () => {
    const { deps } = makeDeps();
    const result = await openAvailabilityRangeWith(deps, {
      fromDate: "2026-12-22",
      toDate: "2026-12-20",
    });
    expect(result).toEqual({ ok: false, error: "INVALID_RANGE" });
  });

  test("RANGE_TOO_LONG past the cap", async () => {
    const { deps } = makeDeps();
    const result = await openAvailabilityRangeWith(deps, {
      fromDate: "2026-01-01",
      toDate: "2026-12-31",
    });
    expect(result).toEqual({ ok: false, error: "RANGE_TOO_LONG" });
  });

  test("NO_ACTIVE_SEASON", async () => {
    const { deps } = makeDeps({ season: null });
    const result = await openAvailabilityRangeWith(deps, {
      fromDate: "2026-12-20",
      toDate: "2026-12-20",
    });
    expect(result).toEqual({ ok: false, error: "NO_ACTIVE_SEASON" });
  });
});

describe("blockAvailabilityWindowWith", () => {
  test("creates a BLOCKED override within hours", async () => {
    const { deps, spies } = makeDeps();
    const result = await blockAvailabilityWindowWith(deps, {
      date: "2026-12-20",
      startTime: "10:00",
      endTime: "12:00",
    });
    expect(result).toEqual({ ok: true, blockId: "new_block" });
    const [{ data }] = spies.create.mock.calls[0] as unknown as [
      { data: { kind: AvailabilityKind; startDateTime: Date } },
    ];
    expect(data.kind).toBe(AvailabilityKind.BLOCKED);
    expect(data.startDateTime.toISOString()).toBe("2026-12-20T10:00:00.000Z");
  });

  test("OUT_OF_HOURS outside operating hours", async () => {
    const { deps } = makeDeps();
    const result = await blockAvailabilityWindowWith(deps, {
      date: "2026-12-20",
      startTime: "07:00",
      endTime: "09:00",
    });
    expect(result).toEqual({ ok: false, error: "OUT_OF_HOURS" });
  });

  test("INVALID_INPUT for malformed time", async () => {
    const { deps } = makeDeps();
    const result = await blockAvailabilityWindowWith(deps, {
      date: "2026-12-20",
      startTime: "25:00",
      endTime: "26:00",
    });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });
});

describe("clearAvailabilityWith", () => {
  const block = {
    id: "blk_1",
    instructorId: "inst_1",
    startDateTime: new Date("2026-12-20T08:00:00.000Z"),
    endDateTime: new Date("2026-12-20T17:00:00.000Z"),
  };

  test("deletes a free block", async () => {
    const { deps, spies } = makeDeps({ block, bookings: [] });
    const result = await clearAvailabilityWith(deps, { blockId: "blk_1" });
    expect(result).toEqual({ ok: true });
    expect(spies.del).toHaveBeenCalledWith({ where: { id: "blk_1" } });
  });

  test("NOT_FOUND when the block does not exist", async () => {
    const { deps } = makeDeps({ block: null });
    const result = await clearAvailabilityWith(deps, { blockId: "missing" });
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  test("FORBIDDEN when the block belongs to another instructor", async () => {
    const { deps } = makeDeps({ block: { ...block, instructorId: "other" } });
    const result = await clearAvailabilityWith(deps, { blockId: "blk_1" });
    expect(result).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  test("HAS_BOOKINGS when an occupying booking sits inside the block", async () => {
    const { deps, spies } = makeDeps({
      block,
      bookings: [
        {
          id: "bk",
          date: new Date("2026-12-20T00:00:00.000Z"),
          anchorTime: "10:00",
          duration: Duration.TWO_HOURS,
          status: BookingStatus.CONFIRMED,
        },
      ],
    });
    const result = await clearAvailabilityWith(deps, { blockId: "blk_1" });
    expect(result).toEqual({ ok: false, error: "HAS_BOOKINGS" });
    expect(spies.del).not.toHaveBeenCalled();
  });
});
