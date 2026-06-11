import type { Prisma } from "@prisma/client";

import { durationMinutes } from "@/lib/booking-engine/duration";
import { addDays, setUtcTime, startOfUtcDay } from "@/lib/booking-engine/time";
import type { Db } from "@/lib/db";
import type {
  SendBookingReminderDeps,
  SendBookingReminderResult,
} from "@/lib/email/send-booking-reminder";
import type {
  SendPostClassDeps,
  SendPostClassResult,
} from "@/lib/email/send-post-class";

export const CANDIDATE_SELECT = {
  id: true,
  date: true,
  anchorTime: true,
  duration: true,
  language: true,
  reminder24hSentAt: true,
  postClassEmailSentAt: true,
} satisfies Prisma.BookingSelect;

export type CandidateRow = Prisma.BookingGetPayload<{
  select: typeof CANDIDATE_SELECT;
}>;

export type CronDeps = {
  prisma: Db;
  sendReminder: (
    deps: SendBookingReminderDeps,
    bookingId: string,
  ) => Promise<SendBookingReminderResult>;
  sendPostClass: (
    deps: SendPostClassDeps,
    bookingId: string,
  ) => Promise<SendPostClassResult>;
  reminderDeps: Omit<SendBookingReminderDeps, "now">;
  postClassDeps: Omit<SendPostClassDeps, "now">;
  now: Date;
};

export type BucketSummary = {
  considered: number;
  sent: number;
  skipped: number;
  errors: number;
};

// Completion sweep does not send anything — it flips stale CONFIRMED rows to
// COMPLETED. `considered` counts rows past their grace window; `flipped` is the
// updateMany count (≤ considered once the status guard excludes any already
// transitioned by a concurrent run).
export type CompleteSummary = {
  considered: number;
  flipped: number;
};

export type CronRunSummary = {
  now: string;
  reminders: BucketSummary;
  postClass: BucketSummary;
  completed: CompleteSummary;
};

export async function runBookingEmailsCron(
  deps: CronDeps,
): Promise<CronRunSummary> {
  const { now } = deps;

  const todayStart = startOfUtcDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const dayAfterTomorrowStart = addDays(todayStart, 2);
  const yesterdayStart = addDays(todayStart, -1);

  // Reminder: every CONFIRMED booking happening tomorrow (UTC day) that has
  // not yet been reminded. The cron runs daily at 17:00 UTC (≈ 18:00 local
  // in CET / 19:00 in CEST) so this notice lands the evening before.
  const reminderCandidates = await deps.prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminder24hSentAt: null,
      date: { gte: tomorrowStart, lt: dayAfterTomorrowStart },
    },
    select: CANDIDATE_SELECT,
  });

  const reminders: BucketSummary = {
    considered: reminderCandidates.length,
    sent: 0,
    skipped: 0,
    errors: 0,
  };

  for (const candidate of reminderCandidates) {
    try {
      const result = await deps.sendReminder(
        { ...deps.reminderDeps, now },
        candidate.id,
      );
      if (result.ok && result.sent) reminders.sent += 1;
      else reminders.skipped += 1;
    } catch (err) {
      reminders.errors += 1;
      console.error(
        `[cron:booking-emails] reminder failed for ${candidate.id}`,
        err,
      );
    }
  }

  // Post-class: every CONFIRMED booking from today (UTC) whose end has
  // already passed, plus a yesterday-fallback for late-end classes that
  // ended after the previous run (e.g. a FULL_DAY lesson finishing past
  // 17:00 UTC). Without the fallback those rows would never flip
  // `postClassEmailSentAt` because the next run would already be looking
  // at a newer day window.
  const postClassCandidates = await deps.prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      postClassEmailSentAt: null,
      date: { gte: yesterdayStart, lt: tomorrowStart },
    },
    select: CANDIDATE_SELECT,
  });

  const postClassTargets = postClassCandidates.filter((b) => {
    const startUtc = setUtcTime(b.date, b.anchorTime);
    const endUtc = new Date(
      startUtc.getTime() + durationMinutes(b.duration) * 60 * 1000,
    );
    return endUtc <= now;
  });

  const postClass: BucketSummary = {
    considered: postClassTargets.length,
    sent: 0,
    skipped: 0,
    errors: 0,
  };

  for (const candidate of postClassTargets) {
    try {
      const result = await deps.sendPostClass(
        { ...deps.postClassDeps, now },
        candidate.id,
      );
      if (result.ok && result.sent) postClass.sent += 1;
      else postClass.skipped += 1;
    } catch (err) {
      postClass.errors += 1;
      console.error(
        `[cron:booking-emails] post-class failed for ${candidate.id}`,
        err,
      );
    }
  }

  // Complete past classes: any CONFIRMED booking whose end (plus a 1h grace)
  // has passed is optimistically flipped to COMPLETED, assuming the lesson
  // took place. Without this sweep such rows live forever in the dashboard's
  // "Upcoming" group (F-057) until the owner closes them by hand. The grace
  // absorbs late-ending same-day classes (a FULL_DAY ending 17:00 UTC at the
  // 17:00 cron) so they flip on the next run rather than prematurely.
  // `autoCompletedAt` marks the transition as automatic so a Sprint 4 admin
  // can re-flip a genuine no-show to CANCELLED_BY_USER (no credit emitted).
  const COMPLETION_GRACE_MS = 60 * 60 * 1000;

  const completionCandidates = await deps.prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      date: { lte: todayStart },
    },
    select: CANDIDATE_SELECT,
  });

  const idsToComplete = completionCandidates
    .filter((b) => {
      const startUtc = setUtcTime(b.date, b.anchorTime);
      const endUtc = new Date(
        startUtc.getTime() + durationMinutes(b.duration) * 60 * 1000,
      );
      return endUtc.getTime() + COMPLETION_GRACE_MS <= now.getTime();
    })
    .map((b) => b.id);

  const completed: CompleteSummary = {
    considered: idsToComplete.length,
    flipped: 0,
  };

  if (idsToComplete.length > 0) {
    // Status guard keeps the sweep idempotent and safe under concurrency: rows
    // already COMPLETED / CANCELLED_* / REFUNDED are excluded, so a re-run is a
    // no-op and a racing transition (e.g. a user cancellation) is not clobbered.
    const result = await deps.prisma.booking.updateMany({
      where: { id: { in: idsToComplete }, status: "CONFIRMED" },
      data: { status: "COMPLETED", autoCompletedAt: now },
    });
    completed.flipped = result.count;
  }

  return { now: now.toISOString(), reminders, postClass, completed };
}
