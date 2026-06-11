"use server";

import { headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/lib/auth";
import { cancelBookingByUserWith, type CancelBookingByUserDeps } from "@/lib/booking/cancel";
import { AVAILABILITY_TAGS } from "@/lib/booking-engine/cache";
import { buildCalendarSyncDeps, deleteEventWith } from "@/lib/calendar/sync";
import { prisma } from "@/lib/db";
import { sendCancellationEmails } from "@/lib/email/send-cancellation";
import { userPhoneSchema } from "@/lib/schemas/user-phone";

export type CancelBookingActionResult =
  | { ok: true; outcome: "credit" | "forfeit" }
  | {
      ok: false;
      error: "UNAUTHORIZED" | "NOT_FOUND" | "FORBIDDEN" | "ALREADY_CANCELLED";
    };

/**
 * Server Action: a booker self-cancels one of their own bookings from the
 * dashboard (F-058). The pure decision (credit vs forfeit, ownership + status
 * checks, atomic status flip) lives in `cancelBookingByUserWith`. Here we:
 *   1. resolve the session,
 *   2. delegate,
 *   3. on success, dispatch the cancellation emails (F-063) and refresh the
 *      caches the freed slot + dashboard depend on.
 *
 * Emails are dispatched best-effort *after* the DB transaction: a Resend
 * hiccup must not roll back a cancellation the booker already confirmed (the
 * row is CANCELLED_BY_USER and any credit is already minted). Failures are
 * reported to Sentry and the action still returns ok.
 */
export async function cancelBookingByUser(
  bookingId: string,
): Promise<CancelBookingActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });

  const deps: CancelBookingByUserDeps = {
    session: session?.user ? { user: { id: session.user.id } } : null,
    prisma,
  };

  const result = await cancelBookingByUserWith(deps, { bookingId });
  if (!result.ok) {
    return result;
  }

  try {
    if (result.outcome === "credit") {
      await sendCancellationEmails({
        bookingId,
        variant: "credit",
        hoursBeforeStart: result.hoursBeforeStart,
        creditAmountCents: result.creditAmountCents,
        creditExpiresAt: result.creditExpiresAt,
      });
    } else {
      await sendCancellationEmails({
        bookingId,
        variant: "forfeit",
        hoursBeforeStart: result.hoursBeforeStart,
      });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { source: "cancel-booking-by-user" },
      extra: { bookingId, outcome: result.outcome },
    });
  }

  // F-075: remove the booking from the instructor's Google Calendar
  // (best-effort). The helper no-ops when there's no synced event and swallows
  // its own errors into onError — a Google failure never fails the cancel the
  // booker already confirmed.
  await deleteEventWith(
    buildCalendarSyncDeps(prisma, (err, ctx) => {
      Sentry.captureException(err, {
        tags: { source: "cancel-booking-by-user" },
        extra: { bookingId, ...ctx },
      });
    }),
    bookingId,
  );

  // The slot is free again (the engine already excludes CANCELLED_BY_*); bust
  // the availability cache so other sessions see it immediately.
  const dateIso = result.date.toISOString().slice(0, 10);
  revalidateTag(AVAILABILITY_TAGS.root);
  revalidateTag(AVAILABILITY_TAGS.duration(result.duration));
  revalidateTag(AVAILABILITY_TAGS.date(dateIso));
  revalidateTag(AVAILABILITY_TAGS.month(dateIso.slice(0, 7)));
  revalidatePath("/[locale]/dashboard", "page");

  return { ok: true, outcome: result.outcome };
}

export type UpdateUserPhoneResult =
  | { ok: true; phone: string | null }
  | { ok: false; error: "UNAUTHORIZED" | "INVALID_PHONE" | "SERVER_ERROR" };

/**
 * F-064b: update (or remove) the signed-in user's phone from the dashboard.
 * An empty string removes the number. Re-resolves the session server-side and
 * re-validates with the shared {@link userPhoneSchema} — never trusts the
 * client. No-ops when the value is unchanged.
 */
export async function updateUserPhone(
  rawPhone: string,
): Promise<UpdateUserPhoneResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = userPhoneSchema.safeParse(rawPhone);
  if (!parsed.success) return { ok: false, error: "INVALID_PHONE" };
  const phone = parsed.data; // string | null

  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });
  // Save without changes is a no-op — skip the write + revalidate.
  if (current?.phone === phone) return { ok: true, phone };

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { phone },
    });
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "SERVER_ERROR" };
  }

  revalidatePath("/[locale]/dashboard", "page");
  return { ok: true, phone };
}
