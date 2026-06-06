"use server";

import { AvailabilityKind } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { revalidatePath, revalidateTag } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { AVAILABILITY_TAGS } from "@/lib/booking-engine/cache";
import {
  cancelBookingByOpsWith,
  type CancelBookingByOpsDeps,
  type CancelBookingByOpsResult,
  type StripeRefundFn,
} from "@/lib/booking/cancel-by-ops";
import { addDays, startOfUtcDay } from "@/lib/booking-engine/time";
import { prisma } from "@/lib/db";
import {
  createInstructorWith,
  deactivateInstructorWith,
  updateInstructorWith,
  type AdminInstructorDeps,
  type CreateInstructorResult,
  type DeactivateInstructorResult,
  type UpdateInstructorResult,
} from "@/lib/admin/instructors";
import { sendCancellationEmails } from "@/lib/email/send-cancellation";
import {
  blockAvailabilityWindowWith,
  clearAvailabilityWith,
  openAvailabilityRangeWith,
  type AvailabilityActionError,
  type AvailabilityDeps,
  type BlockWindowResult,
  type ClearResult,
  type OpenRangeResult,
} from "@/lib/instructor/availability-actions";
import type {
  CreateInstructorInput,
  UpdateInstructorInput,
} from "@/lib/schemas/instructor";
import { getStripe } from "@/lib/stripe/server";

// Thin `"use server"` wrappers for the admin panel. Every action re-checks the
// admin role server-side (never trust a client-sent role). The availability
// actions mirror `app/instructor/actions.ts` but bind the *selected* instructor
// (id comes from the client) instead of the session — so the id is validated
// against an active Instructor before the dependency-injected cores run.

function availabilityDeps(instructorId: string): AvailabilityDeps {
  return {
    prisma: prisma as unknown as AvailabilityDeps["prisma"],
    instructorId,
  };
}

function instructorDeps(): AdminInstructorDeps {
  return { prisma: prisma as unknown as AdminInstructorDeps["prisma"] };
}

// A successful availability mutation must bust the booker-side availability
// cache and refresh both the admin and the affected instructor's views.
function revalidateAvailability() {
  revalidatePath("/admin");
  revalidatePath("/instructor");
  revalidatePath("/instructor/calendar");
  revalidatePath("/instructor/availability");
  revalidateTag(AVAILABILITY_TAGS.root);
}

async function activeInstructorExists(instructorId: string): Promise<boolean> {
  const found = await prisma.instructor.findFirst({
    where: { id: instructorId, active: true },
    select: { id: true },
  });
  return found !== null;
}

export async function adminOpenAvailabilityRange(input: {
  instructorId: string;
  fromDate: string;
  toDate: string;
}): Promise<OpenRangeResult> {
  await requireAdmin();
  if (!(await activeInstructorExists(input.instructorId))) {
    return { ok: false, error: "NOT_FOUND" };
  }
  const result = await openAvailabilityRangeWith(
    availabilityDeps(input.instructorId),
    { fromDate: input.fromDate, toDate: input.toDate },
  );
  if (result.ok) revalidateAvailability();
  return result;
}

export async function adminBlockAvailabilityWindow(input: {
  instructorId: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<BlockWindowResult> {
  await requireAdmin();
  if (!(await activeInstructorExists(input.instructorId))) {
    return { ok: false, error: "NOT_FOUND" };
  }
  const result = await blockAvailabilityWindowWith(
    availabilityDeps(input.instructorId),
    { date: input.date, startTime: input.startTime, endTime: input.endTime },
  );
  if (result.ok) revalidateAvailability();
  return result;
}

export async function adminClearAvailability(input: {
  instructorId: string;
  blockId: string;
}): Promise<ClearResult> {
  await requireAdmin();
  if (!(await activeInstructorExists(input.instructorId))) {
    return { ok: false, error: "NOT_FOUND" };
  }
  const result = await clearAvailabilityWith(availabilityDeps(input.instructorId), {
    blockId: input.blockId,
  });
  if (result.ok) revalidateAvailability();
  return result;
}

// --- "All instructors" batch availability ---------------------------------
// The admin calendar's "All" mode edits every active instructor at once. Open
// loops the per-instructor core over the range; close finds each active
// instructor's AVAILABLE block on the day and clears it. The day panel only
// exposes open/close on booking-free days, so close never trips the booking
// guard — instructors with a class that day are simply not closeable.

async function activeInstructorIds(): Promise<string[]> {
  const rows = await prisma.instructor.findMany({
    where: { active: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function adminOpenRangeAllInstructors(input: {
  fromDate: string;
  toDate: string;
}): Promise<OpenRangeResult> {
  await requireAdmin();
  const ids = await activeInstructorIds();
  let created = 0;
  let firstError: AvailabilityActionError | null = null;
  for (const id of ids) {
    const result = await openAvailabilityRangeWith(availabilityDeps(id), input);
    if (result.ok) created += result.created;
    else if (!firstError) firstError = result.error;
  }
  // Surface the error only when nothing landed (e.g. invalid range / no season
  // hits every instructor identically). A partial success still revalidates.
  if (firstError && created === 0) return { ok: false, error: firstError };
  revalidateAvailability();
  return { ok: true, created };
}

export async function adminCloseDayAllInstructors(input: {
  date: string;
}): Promise<ClearResult> {
  await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  const dayStart = startOfUtcDay(new Date(`${input.date}T00:00:00.000Z`));
  const dayEnd = addDays(dayStart, 1);

  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      instructor: { active: true },
      kind: AvailabilityKind.AVAILABLE,
      startDateTime: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true, instructorId: true },
  });

  for (const block of blocks) {
    // Ownership + booking guard re-checked inside the core; a booked day is
    // simply skipped (the UI never offers close there anyway).
    await clearAvailabilityWith(availabilityDeps(block.instructorId), {
      blockId: block.id,
    });
  }
  revalidateAvailability();
  return { ok: true };
}

export async function createInstructor(
  input: CreateInstructorInput,
): Promise<CreateInstructorResult> {
  await requireAdmin();
  const result = await createInstructorWith(instructorDeps(), input);
  if (result.ok) {
    revalidatePath("/admin/instructors");
    revalidatePath("/admin");
    revalidateTag(AVAILABILITY_TAGS.root);
  }
  return result;
}

export async function updateInstructor(
  input: UpdateInstructorInput,
): Promise<UpdateInstructorResult> {
  await requireAdmin();
  const result = await updateInstructorWith(instructorDeps(), input);
  if (result.ok) {
    revalidatePath("/admin/instructors");
    revalidatePath("/admin");
    revalidateTag(AVAILABILITY_TAGS.root);
  }
  return result;
}

export async function deactivateInstructor(input: {
  instructorId: string;
}): Promise<DeactivateInstructorResult> {
  await requireAdmin();
  const result = await deactivateInstructorWith(instructorDeps(), input);
  if (result.ok) {
    revalidatePath("/admin/instructors");
    revalidatePath("/admin");
    revalidateTag(AVAILABILITY_TAGS.root);
  }
  return result;
}

// --- F-078: ops-cancel ----------------------------------------------------
// Wraps the pure `cancelBookingByOpsWith` core: validates the admin session,
// injects a Stripe refund call (idempotent by booking id), dispatches the
// ops-cancel emails best-effort, and revalidates the affected caches so the
// freed slot reappears and the admin views refresh.

const stripeOpsRefund: StripeRefundFn = async ({
  paymentIntentId,
  amountCents,
  idempotencyKey,
}) => {
  const refund = await getStripe().refunds.create(
    { payment_intent: paymentIntentId, amount: amountCents },
    { idempotencyKey },
  );
  return { id: refund.id };
};

export type CancelBookingByOpsActionResult =
  | {
      ok: true;
      outcome: "cash" | "credit" | "mixed" | "no_charge" | "already_cancelled";
      cashRefundedCents: number;
      creditReEmittedCents: number;
    }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN_STATUS" };

export async function cancelBookingByOps(input: {
  bookingId: string;
  reason?: string;
}): Promise<CancelBookingByOpsActionResult> {
  const { userId } = await requireAdmin();

  const deps: CancelBookingByOpsDeps = {
    adminUserId: userId,
    prisma: prisma as unknown as CancelBookingByOpsDeps["prisma"],
    stripeRefund: stripeOpsRefund,
  };

  let result: CancelBookingByOpsResult;
  try {
    result = await cancelBookingByOpsWith(deps, input);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { source: "cancel-booking-by-ops" },
      extra: { bookingId: input.bookingId },
    });
    throw err;
  }

  if (!result.ok) {
    return result;
  }

  // Skip email dispatch for the already-cancelled short-circuit — the email
  // was already sent on the original cancel.
  if (result.outcome !== "already_cancelled") {
    try {
      await sendCancellationEmails({
        bookingId: input.bookingId,
        variant: "ops",
        opsOutcome: result.outcome,
        cashRefundedCents: result.cashRefundedCents,
        creditReEmittedCents: result.creditReEmittedCents,
        creditExpiresAt: result.creditExpiresAt,
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: {
          source: "cancel-booking-by-ops",
          stage: "dispatch_ops_cancel_email",
        },
        extra: { bookingId: input.bookingId, outcome: result.outcome },
      });
    }

    // Slot is free again — bust the availability cache so other sessions
    // see it immediately. Mirrors the user-cancel revalidation surface.
    const dateIso = result.date.toISOString().slice(0, 10);
    revalidateTag(AVAILABILITY_TAGS.root);
    revalidateTag(AVAILABILITY_TAGS.duration(result.duration));
    revalidateTag(AVAILABILITY_TAGS.date(dateIso));
    revalidateTag(AVAILABILITY_TAGS.month(dateIso.slice(0, 7)));
  }

  // Always refresh the admin views — the row's status changed (or at least
  // a duplicate click should re-render the now-disabled action).
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${input.bookingId}`);
  revalidatePath("/[locale]/dashboard", "page");

  if (result.outcome === "already_cancelled") {
    return {
      ok: true,
      outcome: "already_cancelled",
      cashRefundedCents: 0,
      creditReEmittedCents: 0,
    };
  }
  return {
    ok: true,
    outcome: result.outcome,
    cashRefundedCents: result.cashRefundedCents,
    creditReEmittedCents: result.creditReEmittedCents,
  };
}
