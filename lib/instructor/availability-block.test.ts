import { describe, expect, test, vi } from "vitest";
import {
  AvailabilityKind,
  BookingStatus,
  Duration,
} from "@prisma/client";

import {
  createInstructorAvailabilityBlock,
  deleteInstructorAvailabilityBlock,
} from "./availability-block";

const INSTRUCTOR_ID = "instr_javi";
const NOW = new Date("2026-12-01T08:00:00.000Z");
const SEASON = {
  startDate: new Date("2026-11-15T00:00:00.000Z"),
  endDate: new Date("2027-04-30T00:00:00.000Z"),
};

function makeCreateDeps(overrides?: {
  season?: { startDate: Date; endDate: Date } | null;
  overlapHit?: boolean;
}) {
  const seasonFindFirst = vi.fn(async () =>
    overrides?.season === null ? null : (overrides?.season ?? SEASON),
  );
  const overlapFindFirst = vi.fn(async () =>
    overrides?.overlapHit ? { id: "block_overlap" } : null,
  );
  const created: Array<{
    instructorId: string;
    startDateTime: Date;
    endDateTime: Date;
    kind: AvailabilityKind;
  }> = [];
  const create = vi.fn(async (args: { data: (typeof created)[number] }) => {
    created.push(args.data);
    return { id: `block_${created.length}` };
  });

  const prisma = {
    season: { findFirst: seasonFindFirst },
    availabilityBlock: {
      findFirst: overlapFindFirst,
      create,
    },
  };

  return {
    deps: {
      prisma: prisma as unknown as Parameters<
        typeof createInstructorAvailabilityBlock
      >[0]["prisma"],
      instructorId: INSTRUCTOR_ID,
      now: NOW,
    },
    spies: { seasonFindFirst, overlapFindFirst, create },
    created,
  };
}

describe("createInstructorAvailabilityBlock", () => {
  test("happy path: in-season + no overlap → create + return id", async () => {
    const { deps, created, spies } = makeCreateDeps();
    const res = await createInstructorAvailabilityBlock(deps, {
      date: "2026-12-22",
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(res).toEqual({ ok: true, blockId: "block_1" });
    expect(created).toHaveLength(1);
    expect(created[0]).toEqual({
      instructorId: INSTRUCTOR_ID,
      startDateTime: new Date("2026-12-22T09:00:00.000Z"),
      endDateTime: new Date("2026-12-22T17:00:00.000Z"),
      kind: AvailabilityKind.AVAILABLE,
    });
    expect(spies.overlapFindFirst).toHaveBeenCalled();
  });

  test("end <= start → INVALID_INPUT (Zod refine), no DB calls", async () => {
    const { deps, spies } = makeCreateDeps();
    const res = await createInstructorAvailabilityBlock(deps, {
      date: "2026-12-22",
      startTime: "10:00",
      endTime: "09:00",
    });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(spies.seasonFindFirst).not.toHaveBeenCalled();
  });

  test("end == start → INVALID_INPUT", async () => {
    const { deps } = makeCreateDeps();
    const res = await createInstructorAvailabilityBlock(deps, {
      date: "2026-12-22",
      startTime: "09:00",
      endTime: "09:00",
    });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("malformed date → INVALID_INPUT", async () => {
    const { deps } = makeCreateDeps();
    const res = await createInstructorAvailabilityBlock(deps, {
      date: "not-a-date",
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("no active season → NO_ACTIVE_SEASON", async () => {
    const { deps } = makeCreateDeps({ season: null });
    const res = await createInstructorAvailabilityBlock(deps, {
      date: "2026-12-22",
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(res).toEqual({ ok: false, error: "NO_ACTIVE_SEASON" });
  });

  test("block starts before season → OUT_OF_SEASON", async () => {
    const { deps } = makeCreateDeps();
    const res = await createInstructorAvailabilityBlock(deps, {
      date: "2026-11-14",
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(res).toEqual({ ok: false, error: "OUT_OF_SEASON" });
  });

  test("block ends after season last day → OUT_OF_SEASON", async () => {
    const { deps } = makeCreateDeps();
    const res = await createInstructorAvailabilityBlock(deps, {
      date: "2027-05-01",
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(res).toEqual({ ok: false, error: "OUT_OF_SEASON" });
  });

  test("block on the season's last day still allowed (boundary)", async () => {
    const { deps } = makeCreateDeps();
    const res = await createInstructorAvailabilityBlock(deps, {
      date: "2027-04-30",
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(res.ok).toBe(true);
  });

  test("overlap with existing block → OVERLAP, no create", async () => {
    const { deps, spies } = makeCreateDeps({ overlapHit: true });
    const res = await createInstructorAvailabilityBlock(deps, {
      date: "2026-12-22",
      startTime: "10:00",
      endTime: "12:00",
    });
    expect(res).toEqual({ ok: false, error: "OVERLAP" });
    expect(spies.create).not.toHaveBeenCalled();
  });
});

function makeDeleteDeps(overrides?: {
  block?: {
    id: string;
    instructorId: string;
    startDateTime: Date;
    endDateTime: Date;
  } | null;
  bookings?: Array<{ date: Date; anchorTime: string; duration: Duration }>;
}) {
  const block =
    overrides?.block === null
      ? null
      : (overrides?.block ?? {
          id: "block_1",
          instructorId: INSTRUCTOR_ID,
          startDateTime: new Date("2026-12-22T09:00:00.000Z"),
          endDateTime: new Date("2026-12-22T17:00:00.000Z"),
        });
  const bookings = overrides?.bookings ?? [];

  const blockFindUnique = vi.fn(async () => block);
  const bookingFindMany = vi.fn(async () => bookings);
  const deleted: string[] = [];
  const blockDelete = vi.fn(async (args: { where: { id: string } }) => {
    deleted.push(args.where.id);
    return { id: args.where.id };
  });

  const prisma = {
    availabilityBlock: {
      findUnique: blockFindUnique,
      delete: blockDelete,
    },
    booking: { findMany: bookingFindMany },
  };

  return {
    deps: {
      prisma: prisma as unknown as Parameters<
        typeof deleteInstructorAvailabilityBlock
      >[0]["prisma"],
      instructorId: INSTRUCTOR_ID,
    },
    spies: { blockFindUnique, bookingFindMany, blockDelete },
    deleted,
  };
}

describe("deleteInstructorAvailabilityBlock", () => {
  test("happy path: no conflicting bookings → delete", async () => {
    const { deps, deleted } = makeDeleteDeps();
    const res = await deleteInstructorAvailabilityBlock(deps, "block_1");
    expect(res).toEqual({ ok: true });
    expect(deleted).toEqual(["block_1"]);
  });

  test("block not found → NOT_FOUND", async () => {
    const { deps, spies } = makeDeleteDeps({ block: null });
    const res = await deleteInstructorAvailabilityBlock(deps, "block_missing");
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(spies.blockDelete).not.toHaveBeenCalled();
  });

  test("block owned by another instructor → FORBIDDEN", async () => {
    const { deps, spies } = makeDeleteDeps({
      block: {
        id: "block_2",
        instructorId: "instr_other",
        startDateTime: new Date("2026-12-22T09:00:00.000Z"),
        endDateTime: new Date("2026-12-22T17:00:00.000Z"),
      },
    });
    const res = await deleteInstructorAvailabilityBlock(deps, "block_2");
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(spies.blockDelete).not.toHaveBeenCalled();
  });

  test("contains CONFIRMED booking → HAS_ACTIVE_BOOKINGS", async () => {
    const { deps, spies } = makeDeleteDeps({
      // Booking 10:00 ONE_HOUR sits inside the 09:00-17:00 block.
      bookings: [
        {
          date: new Date("2026-12-22T00:00:00.000Z"),
          anchorTime: "10:00",
          duration: Duration.ONE_HOUR,
        },
      ],
    });
    const res = await deleteInstructorAvailabilityBlock(deps, "block_1");
    expect(res).toEqual({ ok: false, error: "HAS_ACTIVE_BOOKINGS" });
    expect(spies.blockDelete).not.toHaveBeenCalled();
    // The Prisma query already filters by status — assert the call was issued
    // with the expected status set so the conflict check stays honest.
    expect(spies.bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: expect.arrayContaining([
              BookingStatus.PENDING_PAYMENT,
              BookingStatus.CONFIRMED,
            ]),
          },
        }),
      }),
    );
  });

  test("booking outside block window → delete still succeeds", async () => {
    const { deps, deleted } = makeDeleteDeps({
      bookings: [
        {
          date: new Date("2026-12-22T00:00:00.000Z"),
          anchorTime: "18:00",
          duration: Duration.ONE_HOUR,
        },
      ],
    });
    const res = await deleteInstructorAvailabilityBlock(deps, "block_1");
    expect(res).toEqual({ ok: true });
    expect(deleted).toEqual(["block_1"]);
  });
});
