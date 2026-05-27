import type { Duration, Locale } from "@prisma/client";

import { durationMinutes } from "@/lib/booking-engine/duration";
import { addDays, setUtcTime, startOfUtcDay } from "@/lib/booking-engine/time";
import type {
  SendBookingReminderDeps,
  SendBookingReminderResult,
} from "@/lib/email/send-booking-reminder";
import type {
  SendPostClassDeps,
  SendPostClassResult,
} from "@/lib/email/send-post-class";

export type CandidateRow = {
  id: string;
  date: Date;
  anchorTime: string;
  duration: Duration;
  language: Locale;
  reminder24hSentAt: Date | null;
  postClassEmailSentAt: Date | null;
};

export type CronDeps = {
  prisma: {
    booking: {
      findMany(args: {
        where: Record<string, unknown>;
        select: Record<string, unknown>;
      }): Promise<CandidateRow[]>;
    };
  };
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

export type CronRunSummary = {
  now: string;
  reminders: BucketSummary;
  postClass: BucketSummary;
};

export const CANDIDATE_SELECT = {
  id: true,
  date: true,
  anchorTime: true,
  duration: true,
  language: true,
  reminder24hSentAt: true,
  postClassEmailSentAt: true,
} as const;

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

  return { now: now.toISOString(), reminders, postClass };
}
