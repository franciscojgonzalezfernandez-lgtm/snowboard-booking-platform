import { Prisma } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";

import {
  createDiscountCodeWith,
  listDiscountCodesWith,
  setDiscountCodeActiveWith,
  updateDiscountCodeWith,
  type AdminDiscountCodesDeps,
} from "./discount-codes";

const PERCENT_INPUT = {
  code: "vergani",
  label: "Vergani influencer",
  percentOff: 10,
  active: true,
};

const AMOUNT_INPUT = {
  code: "spring20",
  amountOffCents: 2_000,
  active: true,
};

function makeDeps(opts?: {
  findUnique?: unknown;
  createImpl?: () => Promise<{ id: string }>;
  updateImpl?: () => Promise<unknown>;
  findMany?: unknown[];
  grouped?: Array<{ discountCodeId: string | null; _count: { _all: number } }>;
}) {
  const findUnique = vi.fn(async () => opts?.findUnique ?? null);
  const create = vi.fn<
    (args: { data: Record<string, unknown> }) => Promise<{ id: string }>
  >(opts?.createImpl ?? (async () => ({ id: "dc_new" })));
  const update = vi.fn<
    (args: { where: unknown; data: Record<string, unknown> }) => Promise<unknown>
  >(opts?.updateImpl ?? (async () => ({ id: "dc1" })));
  const findMany = vi.fn(async () => opts?.findMany ?? []);
  const groupBy = vi.fn(async () => opts?.grouped ?? []);

  const deps: AdminDiscountCodesDeps = {
    prisma: {
      discountCode: { findUnique, create, update, findMany },
      booking: { groupBy },
    } as unknown as AdminDiscountCodesDeps["prisma"],
  };
  return { deps, spies: { findUnique, create, update, findMany, groupBy } };
}

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("createDiscountCodeWith", () => {
  test("creates a percentage code (uppercased, amount null)", async () => {
    const { deps, spies } = makeDeps();
    const res = await createDiscountCodeWith(deps, PERCENT_INPUT);
    expect(res).toEqual({ ok: true, id: "dc_new" });
    const data = spies.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      code: "VERGANI",
      label: "Vergani influencer",
      percentOff: 10,
      amountOffCents: null,
      maxRedemptions: null,
      active: true,
    });
  });

  test("creates a fixed-amount code (percent null)", async () => {
    const { deps, spies } = makeDeps();
    const res = await createDiscountCodeWith(deps, AMOUNT_INPUT);
    expect(res.ok).toBe(true);
    const data = spies.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ code: "SPRING20", amountOffCents: 2_000, percentOff: null });
  });

  test("rejects both percent and amount set", async () => {
    const { deps, spies } = makeDeps();
    const res = await createDiscountCodeWith(deps, {
      code: "BOTH",
      percentOff: 10,
      amountOffCents: 2_000,
      active: true,
    });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(spies.create).not.toHaveBeenCalled();
  });

  test("rejects neither percent nor amount set", async () => {
    const { deps } = makeDeps();
    const res = await createDiscountCodeWith(deps, {
      code: "EMPTY",
      active: true,
    } as never);
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("rejects invalid code characters", async () => {
    const { deps } = makeDeps();
    const res = await createDiscountCodeWith(deps, { ...PERCENT_INPUT, code: "no spaces" });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("maps a unique-constraint violation to DUPLICATE_CODE", async () => {
    const { deps } = makeDeps({
      createImpl: async () => {
        throw p2002();
      },
    });
    const res = await createDiscountCodeWith(deps, PERCENT_INPUT);
    expect(res).toEqual({ ok: false, error: "DUPLICATE_CODE" });
  });
});

describe("updateDiscountCodeWith", () => {
  test("404s an unknown code", async () => {
    const { deps, spies } = makeDeps({ findUnique: null });
    const res = await updateDiscountCodeWith(deps, "nope", PERCENT_INPUT);
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(spies.update).not.toHaveBeenCalled();
  });

  test("flipping percent → amount clears the other column", async () => {
    const { deps, spies } = makeDeps({ findUnique: { id: "dc1" } });
    const res = await updateDiscountCodeWith(deps, "dc1", AMOUNT_INPUT);
    expect(res).toEqual({ ok: true });
    const data = spies.update.mock.calls[0]![0].data;
    expect(data).toMatchObject({ amountOffCents: 2_000, percentOff: null });
  });

  test("maps a unique-constraint violation to DUPLICATE_CODE", async () => {
    const { deps } = makeDeps({
      findUnique: { id: "dc1" },
      updateImpl: async () => {
        throw p2002();
      },
    });
    const res = await updateDiscountCodeWith(deps, "dc1", PERCENT_INPUT);
    expect(res).toEqual({ ok: false, error: "DUPLICATE_CODE" });
  });
});

describe("setDiscountCodeActiveWith", () => {
  test("404s an unknown code", async () => {
    const { deps } = makeDeps({ findUnique: null });
    const res = await setDiscountCodeActiveWith(deps, "nope", false);
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  test("toggles active", async () => {
    const { deps, spies } = makeDeps({ findUnique: { id: "dc1" } });
    const res = await setDiscountCodeActiveWith(deps, "dc1", false);
    expect(res).toEqual({ ok: true });
    expect(spies.update).toHaveBeenCalledWith({
      where: { id: "dc1" },
      data: { active: false },
    });
  });
});

describe("listDiscountCodesWith", () => {
  test("maps rows and joins the grouped redemption counts", async () => {
    const { deps } = makeDeps({
      findMany: [
        {
          id: "dc1",
          code: "VERGANI",
          label: null,
          percentOff: 10,
          amountOffCents: null,
          maxRedemptions: null,
          active: true,
        },
        {
          id: "dc2",
          code: "SPRING20",
          label: "Spring",
          percentOff: null,
          amountOffCents: 2_000,
          maxRedemptions: 50,
          active: false,
        },
      ],
      grouped: [{ discountCodeId: "dc1", _count: { _all: 3 } }],
    });
    const rows = await listDiscountCodesWith(deps);
    expect(rows[0]).toMatchObject({ id: "dc1", redemptionsUsed: 3 });
    // No grouped entry → zero redemptions.
    expect(rows[1]).toMatchObject({ id: "dc2", redemptionsUsed: 0 });
  });

  test("returns [] without a count query when there are no codes", async () => {
    const { deps, spies } = makeDeps({ findMany: [] });
    const rows = await listDiscountCodesWith(deps);
    expect(rows).toEqual([]);
    expect(spies.groupBy).not.toHaveBeenCalled();
  });
});
