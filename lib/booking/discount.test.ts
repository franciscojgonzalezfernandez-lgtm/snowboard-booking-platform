import { describe, expect, test, vi } from "vitest";

import {
  computeDiscountCents,
  normalizeCode,
  resolveDiscountWith,
  type DiscountDeps,
} from "./discount";

describe("normalizeCode", () => {
  test("trims and uppercases", () => {
    expect(normalizeCode("  vergani ")).toBe("VERGANI");
  });
});

describe("computeDiscountCents", () => {
  test("percentage floors (never over-discounts a fractional cent)", () => {
    expect(computeDiscountCents({ percentOff: 10, amountOffCents: null }, 11_000)).toBe(1_100);
    // 33% of 10_001 = 3300.33 → 3300
    expect(computeDiscountCents({ percentOff: 33, amountOffCents: null }, 10_001)).toBe(3_300);
  });

  test("percentage clamps to 100 and never exceeds the price", () => {
    expect(computeDiscountCents({ percentOff: 100, amountOffCents: null }, 11_000)).toBe(11_000);
    expect(computeDiscountCents({ percentOff: 150, amountOffCents: null }, 11_000)).toBe(11_000);
  });

  test("fixed amount is clamped to the price", () => {
    expect(computeDiscountCents({ percentOff: null, amountOffCents: 2_000 }, 11_000)).toBe(2_000);
    expect(computeDiscountCents({ percentOff: null, amountOffCents: 50_000 }, 11_000)).toBe(11_000);
  });

  test("zero/negative price and malformed code yield zero", () => {
    expect(computeDiscountCents({ percentOff: 10, amountOffCents: null }, 0)).toBe(0);
    expect(computeDiscountCents({ percentOff: null, amountOffCents: null }, 11_000)).toBe(0);
  });
});

type CodeRow = {
  id: string;
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
  maxRedemptions: number | null;
  active: boolean;
} | null;

function makeDeps(opts: {
  code: CodeRow;
  perUserCount?: number;
  globalCount?: number;
}) {
  const findUnique = vi.fn(async () => opts.code);
  // The core calls booking.count twice: per-user (where.bookerId set) then
  // global (no bookerId). Discriminate on the where shape.
  const count = vi.fn(async (args: { where: { bookerId?: string } }) =>
    args.where.bookerId != null ? (opts.perUserCount ?? 0) : (opts.globalCount ?? 0),
  );
  const deps: DiscountDeps = {
    prisma: {
      discountCode: { findUnique },
      booking: { count },
    } as unknown as DiscountDeps["prisma"],
  };
  return { deps, spies: { findUnique, count } };
}

const PERCENT_CODE: CodeRow = {
  id: "dc1",
  code: "VERGANI",
  percentOff: 10,
  amountOffCents: null,
  maxRedemptions: null,
  active: true,
};

describe("resolveDiscountWith", () => {
  test("resolves a valid percentage code and computes the discount", async () => {
    const { deps, spies } = makeDeps({ code: PERCENT_CODE });
    const res = await resolveDiscountWith(deps, {
      codeInput: "vergani",
      userId: "u1",
      totalPriceCents: 20_000,
    });
    expect(res).toEqual({
      ok: true,
      code: { id: "dc1", code: "VERGANI", percentOff: 10, amountOffCents: null },
      discountCents: 2_000,
    });
    // Looked up by the normalized (uppercase) code.
    expect(spies.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: "VERGANI" } }),
    );
  });

  test("empty input is rejected without a DB hit", async () => {
    const { deps, spies } = makeDeps({ code: PERCENT_CODE });
    const res = await resolveDiscountWith(deps, {
      codeInput: "   ",
      userId: "u1",
      totalPriceCents: 20_000,
    });
    expect(res).toEqual({ ok: false, error: "PROMO_INVALID" });
    expect(spies.findUnique).not.toHaveBeenCalled();
  });

  test("unknown code → PROMO_INVALID", async () => {
    const { deps } = makeDeps({ code: null });
    const res = await resolveDiscountWith(deps, {
      codeInput: "nope",
      userId: "u1",
      totalPriceCents: 20_000,
    });
    expect(res).toEqual({ ok: false, error: "PROMO_INVALID" });
  });

  test("inactive code → PROMO_INACTIVE", async () => {
    const { deps } = makeDeps({ code: { ...PERCENT_CODE, active: false } });
    const res = await resolveDiscountWith(deps, {
      codeInput: "vergani",
      userId: "u1",
      totalPriceCents: 20_000,
    });
    expect(res).toEqual({ ok: false, error: "PROMO_INACTIVE" });
  });

  test("already used by this customer → PROMO_ALREADY_USED", async () => {
    const { deps } = makeDeps({ code: PERCENT_CODE, perUserCount: 1 });
    const res = await resolveDiscountWith(deps, {
      codeInput: "vergani",
      userId: "u1",
      totalPriceCents: 20_000,
    });
    expect(res).toEqual({ ok: false, error: "PROMO_ALREADY_USED" });
  });

  test("global cap reached → PROMO_EXHAUSTED", async () => {
    const { deps } = makeDeps({
      code: { ...PERCENT_CODE, maxRedemptions: 5 },
      perUserCount: 0,
      globalCount: 5,
    });
    const res = await resolveDiscountWith(deps, {
      codeInput: "vergani",
      userId: "u1",
      totalPriceCents: 20_000,
    });
    expect(res).toEqual({ ok: false, error: "PROMO_EXHAUSTED" });
  });

  test("unlimited cap (null) ignores the global count", async () => {
    const { deps, spies } = makeDeps({
      code: PERCENT_CODE, // maxRedemptions: null
      perUserCount: 0,
      globalCount: 9_999,
    });
    const res = await resolveDiscountWith(deps, {
      codeInput: "vergani",
      userId: "u1",
      totalPriceCents: 20_000,
    });
    expect(res.ok).toBe(true);
    // Only the per-user count query ran; the global cap was never checked.
    expect(spies.count).toHaveBeenCalledTimes(1);
  });
});
