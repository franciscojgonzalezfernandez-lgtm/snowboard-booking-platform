import type { Duration, Locale } from "@prisma/client";

import { durationMinutes } from "@/lib/booking-engine/duration";
import { addDays, setUtcTime } from "@/lib/booking-engine/time";
import type {
  SendBookingReminderDeps,
  SendBookingReminderResult,
} from "@/lib/email/send-booking-reminder";
import type {
  SendPostClassDeps,
  SendPostClassResult,
} from "@/lib/email/send-post-class";

const REMINDER_OFFSET_HOURS = 24;
const REMINDER_WINDOW_MS = 60 * 60 * 1000;
const POST_CLASS_OFFSET_HOURS = 2;
const POST_CLASS_WINDOW_MS = 60 * 60 * 1000;

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

  const dateLowerBound = addDays(now, -1);
  const dateUpperBound = addDays(now, 2);
  dateLowerBound.setUTCHours(0, 0, 0, 0);
  dateUpperBound.setUTCHours(0, 0, 0, 0);

  const reminderEnd = new Date(
    now.getTime() + REMINDER_OFFSET_HOURS * 60 * 60 * 1000,
  );
  const reminderStart = new Date(reminderEnd.getTime() - REMINDER_WINDOW_MS);
  const postClassEnd = new Date(
    now.getTime() - POST_CLASS_OFFSET_HOURS * 60 * 60 * 1000,
  );
  const postClassStart = new Date(postClassEnd.getTime() - POST_CLASS_WINDOW_MS);

  const reminderCandidates = await deps.prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminder24hSentAt: null,
      date: { gte: dateLowerBound, lte: dateUpperBound },
    },
    select: CANDIDATE_SELECT,
  });

  const reminderTargets = reminderCandidates.filter((b) => {
    const startUtc = setUtcTime(b.date, b.anchorTime);
    return startUtc > reminderStart && startUtc <= reminderEnd;
  });

  const reminders: BucketSummary = {
    considered: reminderTargets.length,
    sent: 0,
    skipped: 0,
    errors: 0,
  };

  for (const candidate of reminderTargets) {
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

  const postClassCandidates = await deps.prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      postClassEmailSentAt: null,
      date: { gte: dateLowerBound, lte: dateUpperBound },
    },
    select: CANDIDATE_SELECT,
  });

  const postClassTargets = postClassCandidates.filter((b) => {
    const startUtc = setUtcTime(b.date, b.anchorTime);
    const endUtc = new Date(
      startUtc.getTime() + durationMinutes(b.duration) * 60 * 1000,
    );
    return endUtc > postClassStart && endUtc <= postClassEnd;
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
