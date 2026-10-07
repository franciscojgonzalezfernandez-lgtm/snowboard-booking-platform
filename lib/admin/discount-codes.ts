import { Prisma } from "@prisma/client";

import { REDEEMED_DISCOUNT_STATUSES } from "@/lib/booking/discount";
import type { Db } from "@/lib/db";
import {
  discountCodeInputSchema,
  type DiscountCodeInput,
} from "@/lib/schemas/discount-code";

// Pure, dependency-injected cores for the discount-code admin UI (F-155),
// mirroring `lib/admin/seasons.ts`: they live in `lib/` so Vitest can drive
// them with a fake Prisma; the thin `"use server"` wrappers in
// `app/(ops)/admin/actions.ts` gate on `requireAdmin()` + revalidate.

export type AdminDiscountCodesDeps = {
  prisma: Db;
};

export type DiscountCodeListRow = {
  id: string;
  code: string;
  label: string | null;
  percentOff: number | null;
  amountOffCents: number | null;
  maxRedemptions: number | null;
  active: boolean;
  /** Non-cancelled bookings that have redeemed this code (the live count). */
  redemptionsUsed: number;
};

export async function listDiscountCodesWith(
  deps: AdminDiscountCodesDeps,
): Promise<DiscountCodeListRow[]> {
  const codes = await deps.prisma.discountCode.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      label: true,
      percentOff: true,
      amountOffCents: true,
      maxRedemptions: true,
      active: true,
    },
  });
  if (codes.length === 0) return [];

  // One grouped count instead of N per-code queries — the redemption ledger is
  // Booking.discountCodeId + status (no sidecar table).
  const grouped = await deps.prisma.booking.groupBy({
    by: ["discountCodeId"],
    where: {
      discountCodeId: { in: codes.map((c) => c.id) },
      status: { in: REDEEMED_DISCOUNT_STATUSES },
    },
    _count: { _all: true },
  });
  const usedById = new Map(
    grouped.map((g) => [g.discountCodeId, g._count._all]),
  );

  return codes.map((c) => ({
    ...c,
    redemptionsUsed: usedById.get(c.id) ?? 0,
  }));
}

/** Map the validated server input to the Prisma write shape. Always writes both
 * discount columns (one null) so an edit that flips the type clears the other. */
function toWriteData(parsed: {
  code: string;
  label?: string;
  percentOff?: number;
  amountOffCents?: number;
  maxRedemptions?: number;
  active: boolean;
}) {
  return {
    code: parsed.code,
    label: parsed.label ?? null,
    percentOff: parsed.percentOff ?? null,
    amountOffCents: parsed.amountOffCents ?? null,
    maxRedemptions: parsed.maxRedemptions ?? null,
    active: parsed.active,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

export type CreateDiscountCodeResult =
  | { ok: true; id: string }
  | { ok: false; error: "INVALID_INPUT" | "DUPLICATE_CODE" };

export async function createDiscountCodeWith(
  deps: AdminDiscountCodesDeps,
  input: DiscountCodeInput,
): Promise<CreateDiscountCodeResult> {
  const parsed = discountCodeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  try {
    const created = await deps.prisma.discountCode.create({
      data: toWriteData(parsed.data),
      select: { id: true },
    });
    return { ok: true, id: created.id };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "DUPLICATE_CODE" };
    throw err;
  }
}

export type UpdateDiscountCodeResult =
  | { ok: true }
  | { ok: false; error: "INVALID_INPUT" | "NOT_FOUND" | "DUPLICATE_CODE" };

export async function updateDiscountCodeWith(
  deps: AdminDiscountCodesDeps,
  id: string,
  input: DiscountCodeInput,
): Promise<UpdateDiscountCodeResult> {
  const parsed = discountCodeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const existing = await deps.prisma.discountCode.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "NOT_FOUND" };

  try {
    await deps.prisma.discountCode.update({
      where: { id },
      data: toWriteData(parsed.data),
    });
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "DUPLICATE_CODE" };
    throw err;
  }
}

export type SetDiscountCodeActiveResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" };

export async function setDiscountCodeActiveWith(
  deps: AdminDiscountCodesDeps,
  id: string,
  active: boolean,
): Promise<SetDiscountCodeActiveResult> {
  const existing = await deps.prisma.discountCode.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "NOT_FOUND" };

  await deps.prisma.discountCode.update({
    where: { id },
    data: { active },
  });
  return { ok: true };
}
