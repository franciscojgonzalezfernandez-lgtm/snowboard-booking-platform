import { describe, expect, test, vi } from "vitest";
import { BookingStatus, Duration, Locale } from "@prisma/client";

import {
  DEFAULT_PAGE_SIZE,
  parseAdminBookingsFilters,
} from "@/lib/schemas/admin-bookings";

import { loadAdminBookings, type AdminBookingRow, type AdminBookingsDeps } from "./bookings";

// Local arg shapes for the recorded calls. Deps now take the full `Db` client,
// so we shape what the suite asserts on rather than deriving from the (widened,
// optional-arg) generated delegate signatures.
type FindManyArgs = {
  where: Record<string, unknown>;
  orderBy: Array<Record<string, "asc" | "desc">>;
  skip: number;
  take: number;
};
type CountArgs = { where: Record<string, unknown> };

function makeRow(overrides: Partial<{ id: string; status: BookingStatus; date: Date; anchorTime: string }> = {}): AdminBookingRow {
  return {
    id: overrides.id ?? "bk_1",
    date: overrides.date ?? new Date("2026-12-15T00:00:00.000Z"),
    anchorTime: overrides.anchorTime ?? "10:00",
    duration: Duration.ONE_HOUR,
    language: Locale.en,
    status: overrides.status ?? BookingStatus.CONFIRMED,
    totalPriceCents: 11000,
    chargeAmountCents: null,
    creditsAppliedCents: null,
    createdAt: new Date("2026-12-01T00:00:00.000Z"),
    booker: { id: "usr_1", name: "Jane", email: "jane@example.com" },
    instructor: { user: { name: "Javi" } },
    attendees: [{ id: "att_1" }],
  };
}

function makeDeps(rows: AdminBookingRow[], total = rows.length) {
  let lastFindManyArgs: FindManyArgs | undefined;
  let lastCountArgs: CountArgs | undefined;
  const count = vi.fn(async (args: CountArgs) => {
    lastCountArgs = args;
    return total;
  });
  const findMany = vi.fn(async (args: FindManyArgs) => {
    lastFindManyArgs = args;
    return rows;
  });
  const deps: AdminBookingsDeps = {
    prisma: { booking: { count, findMany } } as unknown as AdminBookingsDeps["prisma"],
  };
  return {
    deps,
    spies: { count, findMany },
    getFindManyArgs: () => {
      if (!lastFindManyArgs) throw new Error("findMany never invoked");
      return lastFindManyArgs;
    },
    getCountArgs: () => {
      if (!lastCountArgs) throw new Error("count never invoked");
      return lastCountArgs;
    },
  };
}

describe("loadAdminBookings", () => {
  test("no filters → returns all rows with default pagination", async () => {
    const rows = [makeRow({ id: "a" }), makeRow({ id: "b" })];
    const { deps, getFindManyArgs } = makeDeps(rows, 2);
    const filters = parseAdminBookingsFilters({});
    const out = await loadAdminBookings(deps, filters);

    expect(out).toMatchObject({
      total: 2,
      totalPages: 1,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    expect(out.rows).toHaveLength(2);
    const args = getFindManyArgs();
    expect(args.where).toEqual({});
    expect(args.orderBy).toEqual([{ date: "desc" }, { anchorTime: "desc" }]);
    expect(args.skip).toBe(0);
    expect(args.take).toBe(DEFAULT_PAGE_SIZE);
  });

  test("status filter narrows the where clause", async () => {
    const { deps, getFindManyArgs, getCountArgs } = makeDeps([
      makeRow({ status: BookingStatus.CONFIRMED }),
    ]);
    await loadAdminBookings(deps, parseAdminBookingsFilters({ status: "CONFIRMED" }));
    expect(getFindManyArgs().where).toEqual({ status: BookingStatus.CONFIRMED });
    expect(getCountArgs().where).toEqual({ status: BookingStatus.CONFIRMED });
  });

  test("date range inclusive both bounds (gte / lte)", async () => {
    const { deps, getFindManyArgs } = makeDeps([]);
    await loadAdminBookings(
      deps,
      parseAdminBookingsFilters({ from: "2026-12-01", to: "2026-12-31" }),
    );
    expect(getFindManyArgs().where.date).toEqual({
      gte: new Date("2026-12-01T00:00:00.000Z"),
      lte: new Date("2026-12-31T00:00:00.000Z"),
    });
  });

  test("instructorId filter applies direct equality", async () => {
    const { deps, getFindManyArgs } = makeDeps([]);
    await loadAdminBookings(deps, parseAdminBookingsFilters({ instructorId: "inst_1" }));
    expect(getFindManyArgs().where.instructorId).toBe("inst_1");
  });

  test("q searches booker name OR email case-insensitive", async () => {
    const { deps, getFindManyArgs } = makeDeps([]);
    await loadAdminBookings(deps, parseAdminBookingsFilters({ q: " Javi " }));
    expect(getFindManyArgs().where.OR).toEqual([
      { booker: { name: { contains: "Javi", mode: "insensitive" } } },
      { booker: { email: { contains: "Javi", mode: "insensitive" } } },
    ]);
  });

  test("combined filters AND together", async () => {
    const { deps, getFindManyArgs } = makeDeps([]);
    await loadAdminBookings(
      deps,
      parseAdminBookingsFilters({
        status: "CONFIRMED",
        instructorId: "inst_1",
        from: "2026-12-01",
        to: "2026-12-31",
        q: "javi",
      }),
    );
    const where = getFindManyArgs().where;
    expect(where.status).toBe(BookingStatus.CONFIRMED);
    expect(where.instructorId).toBe("inst_1");
    expect(where.date).toEqual({
      gte: new Date("2026-12-01T00:00:00.000Z"),
      lte: new Date("2026-12-31T00:00:00.000Z"),
    });
    expect(where.OR).toHaveLength(2);
  });

  test("page beyond range returns empty rows with correct totalPages", async () => {
    const { deps, getFindManyArgs } = makeDeps([], 7);
    const out = await loadAdminBookings(
      deps,
      parseAdminBookingsFilters({ page: "99", pageSize: "5" }),
    );
    expect(out.total).toBe(7);
    expect(out.totalPages).toBe(2);
    expect(out.rows).toEqual([]);
    expect(getFindManyArgs().skip).toBe((99 - 1) * 5);
    expect(getFindManyArgs().take).toBe(5);
  });

  test("orderBy is date desc then anchorTime desc", async () => {
    const { deps, getFindManyArgs } = makeDeps([]);
    await loadAdminBookings(deps, parseAdminBookingsFilters({}));
    expect(getFindManyArgs().orderBy).toEqual([
      { date: "desc" },
      { anchorTime: "desc" },
    ]);
  });
});
