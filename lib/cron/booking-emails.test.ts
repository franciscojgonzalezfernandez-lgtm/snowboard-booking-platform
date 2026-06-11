import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BookingStatus, Duration, Locale } from "@prisma/client";

import { runBookingEmailsCron, type CandidateRow, type CronDeps } from "./booking-emails";

// CandidateRow has no `status` (every cron query already filters CONFIRMED),
// but the completion sweep's status guard needs exercising — so the fixtures
// carry an optional status the mock honors, defaulting to CONFIRMED.
type TestRow = CandidateRow & { status?: BookingStatus };
import type {
  SendBookingReminderDeps,
  SendBookingReminderResult,
} from "@/lib/email/send-booking-reminder";
import type {
  SendPostClassDeps,
  SendPostClassResult,
} from "@/lib/email/send-post-class";

// Cron runs daily at 17:00 UTC (~18:00 CET / 19:00 CEST). Pin a winter
// evening so test data reflects the real production cadence.
const NOW = new Date("2026-12-15T17:00:00.000Z");
const TOMORROW = new Date("2026-12-16T00:00:00.000Z");
const TODAY = new Date("2026-12-15T00:00:00.000Z");
const YESTERDAY = new Date("2026-12-14T00:00:00.000Z");

function row(
  overrides: Partial<TestRow> & Pick<TestRow, "id" | "date" | "anchorTime">,
): TestRow {
  return {
    duration: Duration.ONE_HOUR,
    language: Locale.en,
    reminder24hSentAt: null,
    postClassEmailSentAt: null,
    ...overrides,
  };
}

type Recorded = {
  reminderCalls: string[];
  postClassCalls: string[];
  reminderLocales: Locale[];
  postClassLocales: Locale[];
  flippedReminder: Set<string>;
  flippedPostClass: Set<string>;
  flippedCompleted: Set<string>;
  completedData: Map<string, Record<string, unknown>>;
};

function makeDeps(opts: {
  candidates: TestRow[];
  now?: Date;
  recorded?: Recorded;
}): { deps: CronDeps; recorded: Recorded } {
  const recorded: Recorded = opts.recorded ?? {
    reminderCalls: [],
    postClassCalls: [],
    reminderLocales: [],
    postClassLocales: [],
    flippedReminder: new Set(),
    flippedPostClass: new Set(),
    flippedCompleted: new Set(),
    completedData: new Map(),
  };

  const statusOf = (c: TestRow): BookingStatus =>
    c.status ?? BookingStatus.CONFIRMED;

  // findMany filters by date range + null flag — mirror that here so a
  // second invocation against the same fixture array respects the just-
  // flipped flag set (idempotency simulation).
  const findMany = vi.fn(async (args: { where: Record<string, unknown> }) => {
    const where = args.where as {
      status?: BookingStatus;
      reminder24hSentAt?: null;
      postClassEmailSentAt?: null;
      date?: { gte?: Date; lt?: Date; lte?: Date };
    };
    // The completion query is the only one keyed by `date.lte` and without a
    // *SentAt flag — use that to apply the COMPLETED-flip exclusion (mirrors
    // the status guard removing already-flipped rows on a re-run).
    const isCompletionQuery = where.date?.lte !== undefined;
    return opts.candidates.filter((c) => {
      const date = c.date.getTime();
      if (where.status && statusOf(c) !== where.status) return false;
      if (where.date?.gte && date < where.date.gte.getTime()) return false;
      if (where.date?.lt && date >= where.date.lt.getTime()) return false;
      if (where.date?.lte && date > where.date.lte.getTime()) return false;
      if ("reminder24hSentAt" in where && recorded.flippedReminder.has(c.id))
        return false;
      if ("postClassEmailSentAt" in where && recorded.flippedPostClass.has(c.id))
        return false;
      if (isCompletionQuery && recorded.flippedCompleted.has(c.id)) return false;
      return true;
    });
  });

  const updateMany = vi.fn(
    async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const where = args.where as { id?: { in?: string[] }; status?: BookingStatus };
      const ids = where.id?.in ?? [];
      let count = 0;
      for (const id of ids) {
        const candidate = opts.candidates.find((c) => c.id === id);
        // Status guard: skip rows that are no longer CONFIRMED, and never
        // double-count a row already flipped by a prior run.
        if (candidate && where.status && statusOf(candidate) !== where.status)
          continue;
        if (recorded.flippedCompleted.has(id)) continue;
        recorded.flippedCompleted.add(id);
        recorded.completedData.set(id, args.data);
        count += 1;
      }
      return { count };
    },
  );

  const sendReminder = vi.fn(
    async (
      _deps: SendBookingReminderDeps,
      bookingId: string,
    ): Promise<SendBookingReminderResult> => {
      const candidate = opts.candidates.find((c) => c.id === bookingId);
      recorded.reminderCalls.push(bookingId);
      if (candidate) recorded.reminderLocales.push(candidate.language);
      recorded.flippedReminder.add(bookingId);
      return { ok: true, sent: true, emailId: `email_r_${bookingId}` };
    },
  );

  const sendPostClass = vi.fn(
    async (
      _deps: SendPostClassDeps,
      bookingId: string,
    ): Promise<SendPostClassResult> => {
      const candidate = opts.candidates.find((c) => c.id === bookingId);
      recorded.postClassCalls.push(bookingId);
      if (candidate) recorded.postClassLocales.push(candidate.language);
      recorded.flippedPostClass.add(bookingId);
      return { ok: true, sent: true, emailId: `email_pc_${bookingId}` };
    },
  );

  const deps: CronDeps = {
    prisma: {
      booking: { findMany, updateMany },
    } as unknown as CronDeps["prisma"],
    sendReminder,
    sendPostClass,
    reminderDeps: {
      prisma: {} as SendBookingReminderDeps["prisma"],
      send: (async () => ({ id: "" })) as SendBookingReminderDeps["send"],
    },
    postClassDeps: {
      prisma: {} as SendPostClassDeps["prisma"],
      send: (async () => ({ id: "" })) as SendPostClassDeps["send"],
    },
    now: opts.now ?? NOW,
  };

  return { deps, recorded };
}

describe("runBookingEmailsCron — reminder (tomorrow's bookings)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  test("picks every CONFIRMED booking dated tomorrow regardless of anchor time", async () => {
    const candidates = [
      row({ id: "early", date: TOMORROW, anchorTime: "08:00" }),
      row({ id: "noon", date: TOMORROW, anchorTime: "12:00" }),
      row({ id: "late", date: TOMORROW, anchorTime: "16:00" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    const summary = await runBookingEmailsCron(deps);
    expect(recorded.reminderCalls.sort()).toEqual(["early", "late", "noon"]);
    expect(summary.reminders.sent).toBe(3);
  });

  test("skips bookings dated today (already covered by previous run or too late)", async () => {
    const candidates = [
      row({ id: "today_class", date: TODAY, anchorTime: "10:00" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.reminderCalls).toEqual([]);
  });

  test("skips bookings dated day-after-tomorrow (next run will catch them)", async () => {
    const candidates = [
      row({
        id: "two_days_out",
        date: new Date("2026-12-17T00:00:00.000Z"),
        anchorTime: "10:00",
      }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.reminderCalls).toEqual([]);
  });

  test("is idempotent — second invocation does not re-call sendReminder", async () => {
    const candidates = [row({ id: "boot1", date: TOMORROW, anchorTime: "10:00" })];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    await runBookingEmailsCron(deps);
    expect(recorded.reminderCalls).toEqual(["boot1"]);
  });

  test("dispatches en + de + es locales in a single run", async () => {
    const candidates = [
      row({ id: "en_b", date: TOMORROW, anchorTime: "10:00", language: Locale.en }),
      row({ id: "de_b", date: TOMORROW, anchorTime: "10:00", language: Locale.de }),
      row({ id: "es_b", date: TOMORROW, anchorTime: "10:00", language: Locale.es }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.reminderLocales.sort()).toEqual(["de", "en", "es"]);
  });
});

describe("runBookingEmailsCron — post-class (today's completed bookings)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  test("sends post-class for today's class that already ended", async () => {
    const candidates = [
      row({
        id: "morning",
        date: TODAY,
        anchorTime: "10:00",
        duration: Duration.TWO_HOURS,
      }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    const summary = await runBookingEmailsCron(deps);
    expect(recorded.postClassCalls).toEqual(["morning"]);
    expect(summary.postClass.sent).toBe(1);
  });

  test("does not send for today's class still in progress at cron time", async () => {
    // FULL_DAY (6h) starting 12:00 ends 18:00 — cron at 17:00, still running.
    const candidates = [
      row({
        id: "still_running",
        date: TODAY,
        anchorTime: "12:00",
        duration: Duration.FULL_DAY,
      }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.postClassCalls).toEqual([]);
  });

  test("catches yesterday's late-end class that finished after the previous run", async () => {
    // FULL_DAY starting 12:00 yesterday ends 18:00 UTC yesterday — that's
    // 1h after yesterday's cron at 17:00 UTC, so it was not eligible then.
    const candidates = [
      row({
        id: "late_yesterday",
        date: YESTERDAY,
        anchorTime: "12:00",
        duration: Duration.FULL_DAY,
      }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.postClassCalls).toEqual(["late_yesterday"]);
  });

  test("does not send for tomorrow's bookings", async () => {
    const candidates = [
      row({ id: "tomorrow_class", date: TOMORROW, anchorTime: "10:00" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.postClassCalls).toEqual([]);
  });

  test("is idempotent — second invocation does not re-call sendPostClass", async () => {
    const candidates = [
      row({ id: "pc_boot", date: TODAY, anchorTime: "10:00" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    await runBookingEmailsCron(deps);
    expect(recorded.postClassCalls).toEqual(["pc_boot"]);
  });

  test("dispatches en + de + es locales in a single run", async () => {
    const candidates = [
      row({ id: "en_pc", date: TODAY, anchorTime: "10:00", language: Locale.en }),
      row({ id: "de_pc", date: TODAY, anchorTime: "10:00", language: Locale.de }),
      row({ id: "es_pc", date: TODAY, anchorTime: "10:00", language: Locale.es }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.postClassLocales.sort()).toEqual(["de", "en", "es"]);
  });
});

describe("runBookingEmailsCron — error isolation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  test("one failing reminder does not block the next candidate", async () => {
    const candidates = [
      row({ id: "fail_one", date: TOMORROW, anchorTime: "10:00" }),
      row({ id: "ok_two", date: TOMORROW, anchorTime: "11:00" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    deps.sendReminder = vi.fn(async (_d, id: string) => {
      if (id === "fail_one") throw new Error("resend boom");
      recorded.reminderCalls.push(id);
      return { ok: true, sent: true, emailId: `e_${id}` };
    }) as CronDeps["sendReminder"];

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const summary = await runBookingEmailsCron(deps);
    errSpy.mockRestore();

    expect(recorded.reminderCalls).toEqual(["ok_two"]);
    expect(summary.reminders.sent).toBe(1);
    expect(summary.reminders.errors).toBe(1);
  });
});

describe("runBookingEmailsCron — complete past classes (auto-flip)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  test("flips a stale CONFIRMED class to COMPLETED with autoCompletedAt", async () => {
    // Yesterday 10:00 ONE_HOUR → ended 11:00 UTC, well past the 1h grace.
    const candidates = [
      row({ id: "stale", date: YESTERDAY, anchorTime: "10:00" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    const summary = await runBookingEmailsCron(deps);

    expect(summary.completed).toEqual({ considered: 1, flipped: 1 });
    expect(recorded.completedData.get("stale")).toEqual({
      status: BookingStatus.COMPLETED,
      autoCompletedAt: NOW,
    });
  });

  test("does not flip a class still inside the 1h grace window", async () => {
    // Today 15:30 ONE_HOUR → ended 16:30; grace pushes eligibility to 17:30,
    // but the cron runs at 17:00 — still inside the window.
    const candidates = [
      row({ id: "just_ended", date: TODAY, anchorTime: "15:30" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    const summary = await runBookingEmailsCron(deps);

    expect(summary.completed).toEqual({ considered: 0, flipped: 0 });
    expect(recorded.flippedCompleted.size).toBe(0);
  });

  test("flips a class exactly at the grace boundary (end + 1h === now)", async () => {
    // Today 15:00 ONE_HOUR → ended 16:00; end + 1h grace === 17:00 === now.
    const candidates = [
      row({ id: "boundary", date: TODAY, anchorTime: "15:00" }),
    ];
    const { deps } = makeDeps({ candidates });
    const summary = await runBookingEmailsCron(deps);

    expect(summary.completed.flipped).toBe(1);
  });

  test("does not flip future CONFIRMED bookings", async () => {
    const candidates = [
      row({ id: "tomorrow_class", date: TOMORROW, anchorTime: "10:00" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    const summary = await runBookingEmailsCron(deps);

    expect(summary.completed).toEqual({ considered: 0, flipped: 0 });
    expect(recorded.flippedCompleted.size).toBe(0);
  });

  test("status guard leaves non-CONFIRMED past bookings untouched", async () => {
    const candidates = [
      row({ id: "confirmed_past", date: YESTERDAY, anchorTime: "10:00" }),
      row({
        id: "already_cancelled",
        date: YESTERDAY,
        anchorTime: "10:00",
        status: BookingStatus.CANCELLED_BY_USER,
      }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    const summary = await runBookingEmailsCron(deps);

    expect(summary.completed).toEqual({ considered: 1, flipped: 1 });
    expect([...recorded.flippedCompleted]).toEqual(["confirmed_past"]);
  });

  test("is idempotent — second invocation does not re-flip", async () => {
    const candidates = [
      row({ id: "once", date: YESTERDAY, anchorTime: "10:00" }),
    ];
    const { deps } = makeDeps({ candidates });
    const first = await runBookingEmailsCron(deps);
    const second = await runBookingEmailsCron(deps);

    expect(first.completed.flipped).toBe(1);
    expect(second.completed).toEqual({ considered: 0, flipped: 0 });
  });
});
