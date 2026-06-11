import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { type ExpireCreditsDeps, runExpireCreditsCron } from "./expire";

const NOW = new Date("2027-01-01T00:00:00.000Z");

type CreditFixtureRow = {
  id: string;
  expiresAt: Date;
};

function makeDeps(opts: {
  creditFixtures: CreditFixtureRow[];
  now?: Date;
}): {
  deps: ExpireCreditsDeps;
  calls: Array<{
    cutoff: Date;
    matched: string[];
    data: Record<string, unknown>;
  }>;
} {
  const calls: Array<{
    cutoff: Date;
    matched: string[];
    data: Record<string, unknown>;
  }> = [];
  const fixtures = [...opts.creditFixtures];

  const updateMany = vi.fn(
    async (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const where = args.where as {
        status?: string;
        expiresAt?: { lt?: Date };
      };
      // Production always scopes to ACTIVE; the guard is what makes the sweep
      // idempotent. If it were dropped, every test below would over-match.
      if (where.status !== "ACTIVE") return { count: 0 };
      const cutoff = where.expiresAt?.lt ?? new Date(0);
      const matched: string[] = [];
      for (const row of fixtures) {
        if (row.expiresAt.getTime() < cutoff.getTime()) matched.push(row.id);
      }
      calls.push({ cutoff, matched: [...matched], data: args.data });
      for (const id of matched) {
        const idx = fixtures.findIndex((r) => r.id === id);
        if (idx >= 0) fixtures.splice(idx, 1);
      }
      return { count: matched.length };
    },
  );

  return {
    deps: {
      prisma: {
        accountCredit: { updateMany },
      } as unknown as ExpireCreditsDeps["prisma"],
      now: opts.now ?? NOW,
    },
    calls,
  };
}

describe("runExpireCreditsCron", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  test("flips ACTIVE credits past expiresAt to EXPIRED", async () => {
    const { deps, calls } = makeDeps({
      creditFixtures: [
        {
          id: "expired_yesterday",
          expiresAt: new Date(NOW.getTime() - 86_400_000),
        },
        { id: "expired_1min", expiresAt: new Date(NOW.getTime() - 60_000) },
        {
          id: "valid_tomorrow",
          expiresAt: new Date(NOW.getTime() + 86_400_000),
        },
      ],
    });
    const summary = await runExpireCreditsCron(deps);
    expect(summary.expired).toBe(2);
    expect(calls[0]!.matched.sort()).toEqual([
      "expired_1min",
      "expired_yesterday",
    ]);
    expect(calls[0]!.data).toMatchObject({ status: "EXPIRED" });
  });

  test("uses now as the cutoff (expiresAt < now)", async () => {
    const { deps, calls } = makeDeps({ creditFixtures: [] });
    await runExpireCreditsCron(deps);
    expect(calls[0]!.cutoff.getTime()).toBe(NOW.getTime());
  });

  test("boundary: expiresAt exactly now is NOT expired (strictly older)", async () => {
    const { deps } = makeDeps({
      creditFixtures: [{ id: "exact", expiresAt: new Date(NOW.getTime()) }],
    });
    const summary = await runExpireCreditsCron(deps);
    expect(summary.expired).toBe(0);
  });

  test("idempotent: second invocation finds nothing to flip", async () => {
    const { deps } = makeDeps({
      creditFixtures: [
        { id: "old", expiresAt: new Date(NOW.getTime() - 60_000) },
      ],
    });
    const first = await runExpireCreditsCron(deps);
    const second = await runExpireCreditsCron(deps);
    expect(first.expired).toBe(1);
    expect(second.expired).toBe(0);
  });

  test("summary surfaces an ISO timestamp for observability", async () => {
    const { deps } = makeDeps({ creditFixtures: [] });
    const summary = await runExpireCreditsCron(deps);
    expect(summary.now).toBe(NOW.toISOString());
  });
});
