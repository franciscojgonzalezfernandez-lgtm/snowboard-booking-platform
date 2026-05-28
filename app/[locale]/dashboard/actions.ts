"use server";

import { headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/lib/auth";
import { cancelBookingByUserWith, type CancelBookingByUserDeps } from "@/lib/booking/cancel";
import { AVAILABILITY_TAGS } from "@/lib/booking-engine/cache";
import { prisma } from "@/lib/db";
import { sendCancellationEmails } from "@/lib/email/send-cancellation";

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
    prisma: prisma as unknown as CancelBookingByUserDeps["prisma"],
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
