import { describe, expect, test, vi } from "vitest";
import { BookingStatus } from "@prisma/client";

import {
  getBookerNoteHistories,
  setInstructorNoteWith,
  BOOKER_HISTORY_LIMIT,
} from "./instructor-note";

const INSTRUCTOR_ID = "instr_javi";
const NOW = new Date("2026-12-01T08:00:00.000Z");

function makeSetDeps(overrides?: {
  booking?: { instructorId: string; status: BookingStatus } | null;
}) {
  const booking =
    overrides?.booking === null
      ? null
      : (overrides?.booking ?? {
          instructorId: INSTRUCTOR_ID,
          status: BookingStatus.COMPLETED,
        });

  const findUnique = vi.fn(async () => booking);
  const updates: Array<{
    instructorNote: string | null;
    instructorNoteSetAt: Date | null;
  }> = [];
  const update = vi.fn(
    async (args: { data: (typeof updates)[number] }) => {
      updates.push(args.data);
      return { id: "bk_1" };
    },
  );

  const prisma = { booking: { findUnique, update } };

  return {
    deps: {
      prisma: prisma as unknown as Parameters<
        typeof setInstructorNoteWith
      >[0]["prisma"],
      instructorId: INSTRUCTOR_ID,
      now: NOW,
    },
    spies: { findUnique, update },
    updates,
  };
}

describe("setInstructorNoteWith", () => {
  test("happy path: COMPLETED + own booking → persists note + setAt", async () => {
    const { deps, updates } = makeSetDeps();
    const res = await setInstructorNoteWith(deps, {
      bookingId: "bk_1",
      note: "  Strong toeside, push heelside carving next time.  ",
    });
    expect(res).toEqual({ ok: true, cleared: false, setAt: NOW });
    expect(updates).toHaveLength(1);
    // Trimmed before persisting.
    expect(updates[0]).toEqual({
      instructorNote: "Strong toeside, push heelside carving next time.",
      instructorNoteSetAt: NOW,
    });
  });

  test("role guard is the action's job, but a foreign booking → FORBIDDEN", async () => {
    const { deps, spies } = makeSetDeps({
      booking: { instructorId: "instr_other", status: BookingStatus.COMPLETED },
    });
    const res = await setInstructorNoteWith(deps, {
      bookingId: "bk_1",
      note: "trying to write on someone else's class",
    });
    expect(res).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(spies.update).not.toHaveBeenCalled();
  });

  test("booking not COMPLETED → NOT_COMPLETED, no write", async () => {
    const { deps, spies } = makeSetDeps({
      booking: { instructorId: INSTRUCTOR_ID, status: BookingStatus.CONFIRMED },
    });
    const res = await setInstructorNoteWith(deps, {
      bookingId: "bk_1",
      note: "class hasn't happened yet",
    });
    expect(res).toEqual({ ok: false, error: "NOT_COMPLETED" });
    expect(spies.update).not.toHaveBeenCalled();
  });

  test("booking not found → NOT_FOUND, no write", async () => {
    const { deps, spies } = makeSetDeps({ booking: null });
    const res = await setInstructorNoteWith(deps, {
      bookingId: "bk_missing",
      note: "anything",
    });
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(spies.update).not.toHaveBeenCalled();
  });

  test("empty string clears both columns (note=null, setAt=null)", async () => {
    const { deps, updates } = makeSetDeps();
    const res = await setInstructorNoteWith(deps, {
      bookingId: "bk_1",
      note: "   ",
    });
    expect(res).toEqual({ ok: true, cleared: true, setAt: null });
    expect(updates[0]).toEqual({
      instructorNote: null,
      instructorNoteSetAt: null,
    });
  });

  test("null note also clears", async () => {
    const { deps, updates } = makeSetDeps();
    const res = await setInstructorNoteWith(deps, {
      bookingId: "bk_1",
      note: null,
    });
    expect(res).toEqual({ ok: true, cleared: true, setAt: null });
    expect(updates[0]).toEqual({
      instructorNote: null,
      instructorNoteSetAt: null,
    });
  });
});

describe("getBookerNoteHistories", () => {
  function makeHistoryDeps(rows: Array<{
    id: string;
    bookerId: string;
    date: Date;
    instructorNote: string | null;
    instructorNoteSetAt: Date | null;
  }>) {
    const findMany = vi.fn(async () => rows);
    const prisma = { booking: { findMany } };
    return {
      deps: {
        prisma: prisma as unknown as Parameters<
          typeof getBookerNoteHistories
        >[0]["prisma"],
        instructorId: INSTRUCTOR_ID,
      },
      spies: { findMany },
    };
  }

  test("no booker ids → empty map, no query", async () => {
    const { deps, spies } = makeHistoryDeps([]);
    const map = await getBookerNoteHistories(deps, []);
    expect(map.size).toBe(0);
    expect(spies.findMany).not.toHaveBeenCalled();
  });

  test("buckets rows by bookerId, scoped + ordered by the query", async () => {
    const { deps, spies } = makeHistoryDeps([
      {
        id: "bk_2",
        bookerId: "u_a",
        date: new Date("2026-02-10T00:00:00.000Z"),
        instructorNote: "second note",
        instructorNoteSetAt: NOW,
      },
      {
        id: "bk_1",
        bookerId: "u_a",
        date: new Date("2026-01-05T00:00:00.000Z"),
        instructorNote: "first note",
        instructorNoteSetAt: NOW,
      },
      {
        id: "bk_3",
        bookerId: "u_b",
        date: new Date("2026-03-01T00:00:00.000Z"),
        instructorNote: "other booker",
        instructorNoteSetAt: null,
      },
    ]);

    const map = await getBookerNoteHistories(deps, ["u_a", "u_b", "u_a"]);

    expect(map.get("u_a")?.map((e) => e.bookingId)).toEqual(["bk_2", "bk_1"]);
    expect(map.get("u_b")?.map((e) => e.note)).toEqual(["other booker"]);

    // De-duplicated booker ids + correct scoping passed to the query.
    expect(spies.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          instructorId: INSTRUCTOR_ID,
          bookerId: { in: ["u_a", "u_b"] },
          status: BookingStatus.COMPLETED,
          instructorNote: { not: null },
        }),
        orderBy: { date: "desc" },
      }),
    );
  });

  test("caps each booker at BOOKER_HISTORY_LIMIT", async () => {
    const rows = Array.from({ length: BOOKER_HISTORY_LIMIT + 5 }, (_, i) => ({
      id: `bk_${i}`,
      bookerId: "u_a",
      date: new Date(2026, 0, i + 1),
      instructorNote: `note ${i}`,
      instructorNoteSetAt: NOW,
    }));
    const { deps } = makeHistoryDeps(rows);
    const map = await getBookerNoteHistories(deps, ["u_a"]);
    expect(map.get("u_a")).toHaveLength(BOOKER_HISTORY_LIMIT);
  });
});
