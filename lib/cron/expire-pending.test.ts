import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  PENDING_PAYMENT_EXPIRY_MS,
  type ExpirePendingDeps,
  runExpirePendingCron,
} from "./expire-pending";

const NOW = new Date("2026-12-15T17:00:00.000Z");

type PendingFixtureRow = {
  id: string;
  createdAt: Date;
};

type CreditFixtureRow = {
  id: string;
  lockedByBookingId: string | null;
  status: string;
};

function makeDeps(opts: {
  pendingFixtures: PendingFixtureRow[];
  creditFixtures?: CreditFixtureRow[];
  now?: Date;
}): {
  deps: ExpirePendingDeps;
  /** Cutoff captured from the snapshot findMany, fired on every run. */
  cutoffs: Date[];
  /** Flip updateMany calls (skipped when nothing is stale). */
  calls: Array<{
    cutoff: Date;
    matched: string[];
    data: Record<string, unknown>;
  }>;
  creditReleases: Array<{ ids: string[]; released: string[] }>;
} {
  const cutoffs: Date[] = [];
  const calls: Array<{
    cutoff: Date;
    matched: string[];
    data: Record<string, unknown>;
  }> = [];
  const creditReleases: Array<{ ids: string[]; released: string[] }> = [];
  const fixtures = [...opts.pendingFixtures];
  const credits = (opts.creditFixtures ?? []).map((c) => ({ ...c }));

  const findMany = vi.fn(
    async (args: { where: Record<string, unknown>; select: unknown }) => {
      const where = args.where as {
        status?: string;
        createdAt?: { lt?: Date };
      };
      const cutoff = where.createdAt?.lt ?? new Date(0);
      cutoffs.push(cutoff);
      if (where.status !== "PENDING_PAYMENT") return [];
      return fixtures
        .filter((row) => row.createdAt.getTime() < cutoff.getTime())
        .map((row) => ({ id: row.id }));
    },
  );

  const updateMany = vi.fn(
    async (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const where = args.where as {
        id?: { in?: string[] };
        status?: string;
        createdAt?: { lt?: Date };
      };
      if (where.status !== "PENDING_PAYMENT") return { count: 0 };
      const cutoff = where.createdAt?.lt ?? new Date(0);
      const idSet = new Set(where.id?.in ?? []);
      const matched: string[] = [];
      for (const row of fixtures) {
        if (idSet.has(row.id) && row.createdAt.getTime() < cutoff.getTime()) {
          matched.push(row.id);
        }
      }
      calls.push({ cutoff, matched: [...matched], data: args.data });
      for (const id of matched) {
        const idx = fixtures.findIndex((r) => r.id === id);
        if (idx >= 0) fixtures.splice(idx, 1);
      }
      return { count: matched.length };
    },
  );

  const creditUpdateMany = vi.fn(
    async (args: {
      where: { lockedByBookingId?: { in?: string[] }; status?: string };
      data: Record<string, unknown>;
    }) => {
      const ids = args.where.lockedByBookingId?.in ?? [];
      const idSet = new Set(ids);
      const released: string[] = [];
      for (const credit of credits) {
        if (
          credit.lockedByBookingId !== null &&
          idSet.has(credit.lockedByBookingId) &&
          credit.status === args.where.status
        ) {
          Object.assign(credit, args.data);
          released.push(credit.id);
        }
      }
      creditReleases.push({ ids: [...ids], released });
      return { count: released.length };
    },
  );

  return {
    deps: {
      prisma: {
        booking: { findMany, updateMany },
        accountCredit: { updateMany: creditUpdateMany },
      } as unknown as ExpirePendingDeps["prisma"],
      now: opts.now ?? NOW,
    },
    cutoffs,
    calls,
    creditReleases,
  };
}

describe("runExpirePendingCron", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  test("flips PENDING_PAYMENT rows older than 15 minutes to PAYMENT_FAILED", async () => {
    const { deps, calls } = makeDeps({
      pendingFixtures: [
        { id: "stale_30m", createdAt: new Date(NOW.getTime() - 30 * 60_000) },
        { id: "stale_20m", createdAt: new Date(NOW.getTime() - 20 * 60_000) },
        { id: "fresh_5m", createdAt: new Date(NOW.getTime() - 5 * 60_000) },
      ],
    });
    const summary = await runExpirePendingCron(deps);
    expect(summary.flipped).toBe(2);
    expect(calls[0]!.matched.sort()).toEqual(["stale_20m", "stale_30m"]);
  });

  test("uses now - 15m as the cutoff exactly", async () => {
    const { deps, cutoffs } = makeDeps({ pendingFixtures: [] });
    await runExpirePendingCron(deps);
    expect(cutoffs[0]!.getTime()).toBe(
      NOW.getTime() - PENDING_PAYMENT_EXPIRY_MS,
    );
  });

  test("boundary: createdAt exactly 15m ago is NOT flipped (strictly older)", async () => {
    const { deps } = makeDeps({
      pendingFixtures: [
        { id: "exact_boundary", createdAt: new Date(NOW.getTime() - PENDING_PAYMENT_EXPIRY_MS) },
      ],
    });
    const summary = await runExpirePendingCron(deps);
    expect(summary.flipped).toBe(0);
  });

  test("idempotent: second invocation finds nothing to flip", async () => {
    const { deps } = makeDeps({
      pendingFixtures: [
        { id: "stale", createdAt: new Date(NOW.getTime() - 30 * 60_000) },
      ],
    });
    const first = await runExpirePendingCron(deps);
    const second = await runExpirePendingCron(deps);
    expect(first.flipped).toBe(1);
    expect(second.flipped).toBe(0);
  });

  test("stamps notes='expired time' so admin can distinguish cron-expiry from a Stripe payment_failed", async () => {
    const { deps, calls } = makeDeps({
      pendingFixtures: [
        { id: "stale", createdAt: new Date(NOW.getTime() - 30 * 60_000) },
      ],
    });
    await runExpirePendingCron(deps);
    expect(calls[0]!.data).toMatchObject({
      status: "PAYMENT_FAILED",
      notes: "expired time",
    });
  });

  test("summary surfaces an ISO timestamp for observability", async () => {
    const { deps } = makeDeps({ pendingFixtures: [] });
    const summary = await runExpirePendingCron(deps);
    expect(summary.now).toBe(NOW.toISOString());
  });

  test("F-060: releases credits LOCKED by an expired draft back to ACTIVE", async () => {
    const { deps, creditReleases } = makeDeps({
      pendingFixtures: [
        { id: "stale_draft", createdAt: new Date(NOW.getTime() - 30 * 60_000) },
      ],
      creditFixtures: [
        { id: "cr_1", lockedByBookingId: "stale_draft", status: "LOCKED" },
        { id: "cr_other", lockedByBookingId: "other_draft", status: "LOCKED" },
      ],
    });
    const summary = await runExpirePendingCron(deps);
    expect(summary.flipped).toBe(1);
    expect(summary.creditsReleased).toBe(1);
    expect(creditReleases[0]!.released).toEqual(["cr_1"]);
  });

  test("F-060: no stale drafts → credit release is skipped entirely", async () => {
    const { deps, creditReleases } = makeDeps({
      pendingFixtures: [
        { id: "fresh", createdAt: new Date(NOW.getTime() - 5 * 60_000) },
      ],
      creditFixtures: [
        { id: "cr_1", lockedByBookingId: "fresh", status: "LOCKED" },
      ],
    });
    const summary = await runExpirePendingCron(deps);
    expect(summary.flipped).toBe(0);
    expect(summary.creditsReleased).toBe(0);
    expect(creditReleases).toHaveLength(0);
  });
});
