import { describe, expect, test, vi } from "vitest";

import {
  loadDashboardOverview,
  type DashboardOverviewDeps,
} from "./overview";

const USER_ID = "user_1";
const NOW = new Date("2026-12-10T10:00:00.000Z");

type RecordedArgs = Record<string, unknown>;

function makeDeps() {
  const calls: {
    bookingFindMany: RecordedArgs[];
    creditFindMany: RecordedArgs[];
    userFindUnique: RecordedArgs[];
  } = { bookingFindMany: [], creditFindMany: [], userFindUnique: [] };

  const bookingFindMany = vi.fn(async (args: RecordedArgs) => {
    calls.bookingFindMany.push(args);
    return [];
  });
  const creditFindMany = vi.fn(async (args: RecordedArgs) => {
    calls.creditFindMany.push(args);
    return [];
  });
  const userFindUnique = vi.fn(async (args: RecordedArgs) => {
    calls.userFindUnique.push(args);
    return null;
  });

  const deps: DashboardOverviewDeps = {
    prisma: {
      booking: { findMany: bookingFindMany },
      accountCredit: { findMany: creditFindMany },
      user: { findUnique: userFindUnique },
    } as unknown as DashboardOverviewDeps["prisma"],
  };
  return { deps, calls };
}

describe("loadDashboardOverview", () => {
  test("scopes every query to the session user", async () => {
    const { deps, calls } = makeDeps();
    await loadDashboardOverview(deps, { userId: USER_ID, now: NOW });

    expect(calls.bookingFindMany[0]?.where).toEqual({ bookerId: USER_ID });
    for (const args of calls.creditFindMany) {
      expect((args.where as RecordedArgs).userId).toBe(USER_ID);
    }
    expect(calls.userFindUnique[0]?.where).toEqual({ id: USER_ID });
  });

  test("bookings ordered newest class first (date desc, anchorTime desc)", async () => {
    const { deps, calls } = makeDeps();
    await loadDashboardOverview(deps, { userId: USER_ID, now: NOW });

    expect(calls.bookingFindMany[0]?.orderBy).toEqual([
      { date: "desc" },
      { anchorTime: "desc" },
    ]);
  });

  test("active credits filtered to ACTIVE + unexpired and ordered by expiry", async () => {
    const { deps, calls } = makeDeps();
    await loadDashboardOverview(deps, { userId: USER_ID, now: NOW });

    const activeCall = calls.creditFindMany.find(
      (args) => (args.where as RecordedArgs).status === "ACTIVE",
    );
    expect(activeCall).toBeDefined();
    expect(activeCall?.where).toEqual({
      userId: USER_ID,
      status: "ACTIVE",
      expiresAt: { gt: NOW },
    });
    expect(activeCall?.orderBy).toEqual({ expiresAt: "asc" });
  });

  test("ledger query has no status filter (full history)", async () => {
    const { deps, calls } = makeDeps();
    await loadDashboardOverview(deps, { userId: USER_ID, now: NOW });

    const ledgerCall = calls.creditFindMany.find(
      (args) => (args.where as RecordedArgs).status === undefined,
    );
    expect(ledgerCall?.where).toEqual({ userId: USER_ID });
  });

  test("returns the four result sets as one overview object", async () => {
    const { deps } = makeDeps();
    const overview = await loadDashboardOverview(deps, {
      userId: USER_ID,
      now: NOW,
    });
    expect(overview).toEqual({
      bookings: [],
      credits: [],
      activeCredits: [],
      account: null,
    });
  });
});
