import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Duration, Locale } from "@prisma/client";

import { runBookingEmailsCron, type CandidateRow, type CronDeps } from "./booking-emails";
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
  overrides: Partial<CandidateRow> & Pick<CandidateRow, "id" | "date" | "anchorTime">,
): CandidateRow {
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
  pendingExpiryCalls: Array<{
    cutoff: Date;
    matched: string[];
  }>;
};

type PendingFixtureRow = {
  id: string;
  createdAt: Date;
};

function makeDeps(opts: {
  candidates: CandidateRow[];
  pendingFixtures?: PendingFixtureRow[];
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
    pendingExpiryCalls: [],
  };

  // findMany filters by date range + null flag — mirror that here so a
  // second invocation against the same fixture array respects the just-
  // flipped flag set (idempotency simulation).
  const findMany = vi.fn(async (args: { where: Record<string, unknown> }) => {
    const where = args.where as {
      reminder24hSentAt?: null;
      postClassEmailSentAt?: null;
      date?: { gte?: Date; lt?: Date };
    };
    return opts.candidates.filter((c) => {
      const date = c.date.getTime();
      if (where.date?.gte && date < where.date.gte.getTime()) return false;
      if (where.date?.lt && date >= where.date.lt.getTime()) return false;
      if ("reminder24hSentAt" in where && recorded.flippedReminder.has(c.id))
        return false;
      if ("postClassEmailSentAt" in where && recorded.flippedPostClass.has(c.id))
        return false;
      return true;
    });
  });

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

  const pendingFixtures = opts.pendingFixtures ?? [];
  const updateMany = vi.fn(async (args: { where: Record<string, unknown> }) => {
    const where = args.where as {
      status?: string;
      createdAt?: { lt?: Date };
    };
    if (where.status !== "PENDING_PAYMENT") return { count: 0 };
    const cutoff = where.createdAt?.lt ?? new Date(0);
    const matched: string[] = [];
    for (const row of pendingFixtures) {
      if (row.createdAt.getTime() < cutoff.getTime()) matched.push(row.id);
    }
    recorded.pendingExpiryCalls.push({ cutoff, matched: [...matched] });
    // Remove matched rows from the fixture array so a second invocation is a
    // no-op (mirrors the status guard in the production updateMany).
    for (const id of matched) {
      const idx = pendingFixtures.findIndex((r) => r.id === id);
      if (idx >= 0) pendingFixtures.splice(idx, 1);
    }
    return { count: matched.length };
  });

  const deps: CronDeps = {
    prisma: {
      booking: {
        findMany: findMany as unknown as CronDeps["prisma"]["booking"]["findMany"],
        updateMany: updateMany as unknown as CronDeps["prisma"]["booking"]["updateMany"],
      },
    },
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

describe("runBookingEmailsCron — pending-payment expiry sweep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  test("flips PENDING_PAYMENT rows older than 15 minutes to PAYMENT_FAILED", async () => {
    const pendingFixtures: PendingFixtureRow[] = [
      { id: "stale_30m", createdAt: new Date(NOW.getTime() - 30 * 60_000) },
      { id: "stale_20m", createdAt: new Date(NOW.getTime() - 20 * 60_000) },
      { id: "fresh_5m", createdAt: new Date(NOW.getTime() - 5 * 60_000) },
    ];
    const { deps, recorded } = makeDeps({ candidates: [], pendingFixtures });
    const summary = await runBookingEmailsCron(deps);

    expect(summary.pendingExpiry.flipped).toBe(2);
    expect(recorded.pendingExpiryCalls.length).toBe(1);
    expect(recorded.pendingExpiryCalls[0]!.matched.sort()).toEqual([
      "stale_20m",
      "stale_30m",
    ]);
  });

  test("uses now - 15m as the cutoff exactly (boundary at the minute)", async () => {
    const { deps, recorded } = makeDeps({ candidates: [] });
    await runBookingEmailsCron(deps);
    const cutoff = recorded.pendingExpiryCalls[0]!.cutoff;
    expect(cutoff.getTime()).toBe(NOW.getTime() - 15 * 60_000);
  });

  test("boundary: createdAt exactly 15m ago is NOT flipped (strictly older)", async () => {
    const pendingFixtures: PendingFixtureRow[] = [
      { id: "exact_boundary", createdAt: new Date(NOW.getTime() - 15 * 60_000) },
    ];
    const { deps } = makeDeps({ candidates: [], pendingFixtures });
    const summary = await runBookingEmailsCron(deps);
    expect(summary.pendingExpiry.flipped).toBe(0);
  });

  test("idempotent: second invocation finds nothing to flip", async () => {
    const pendingFixtures: PendingFixtureRow[] = [
      { id: "stale", createdAt: new Date(NOW.getTime() - 30 * 60_000) },
    ];
    const { deps } = makeDeps({ candidates: [], pendingFixtures });
    const first = await runBookingEmailsCron(deps);
    const second = await runBookingEmailsCron(deps);
    expect(first.pendingExpiry.flipped).toBe(1);
    expect(second.pendingExpiry.flipped).toBe(0);
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
