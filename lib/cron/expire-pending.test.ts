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

function makeDeps(opts: {
  pendingFixtures: PendingFixtureRow[];
  now?: Date;
}): {
  deps: ExpirePendingDeps;
  calls: Array<{ cutoff: Date; matched: string[] }>;
} {
  const calls: Array<{ cutoff: Date; matched: string[] }> = [];
  const fixtures = [...opts.pendingFixtures];

  const updateMany = vi.fn(async (args: { where: Record<string, unknown> }) => {
    const where = args.where as {
      status?: string;
      createdAt?: { lt?: Date };
    };
    if (where.status !== "PENDING_PAYMENT") return { count: 0 };
    const cutoff = where.createdAt?.lt ?? new Date(0);
    const matched: string[] = [];
    for (const row of fixtures) {
      if (row.createdAt.getTime() < cutoff.getTime()) matched.push(row.id);
    }
    calls.push({ cutoff, matched: [...matched] });
    for (const id of matched) {
      const idx = fixtures.findIndex((r) => r.id === id);
      if (idx >= 0) fixtures.splice(idx, 1);
    }
    return { count: matched.length };
  });

  return {
    deps: {
      prisma: {
        booking: {
          updateMany: updateMany as unknown as ExpirePendingDeps["prisma"]["booking"]["updateMany"],
        },
      },
      now: opts.now ?? NOW,
    },
    calls,
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
    const { deps, calls } = makeDeps({ pendingFixtures: [] });
    await runExpirePendingCron(deps);
    expect(calls[0]!.cutoff.getTime()).toBe(
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

  test("summary surfaces an ISO timestamp for observability", async () => {
    const { deps } = makeDeps({ pendingFixtures: [] });
    const summary = await runExpirePendingCron(deps);
    expect(summary.now).toBe(NOW.toISOString());
  });
});
