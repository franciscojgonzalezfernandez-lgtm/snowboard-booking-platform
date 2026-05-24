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

const NOW = new Date("2026-05-24T10:00:00.000Z");

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
};

function makeDeps(opts: {
  candidates: CandidateRow[];
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
  };

  // findMany filters by null flag — mirror that here so idempotency works in
  // the simulated DB even when the same fixture array is reused across calls.
  const findMany = vi.fn(async (args: { where: Record<string, unknown> }) => {
    const where = args.where as {
      reminder24hSentAt?: null;
      postClassEmailSentAt?: null;
    };
    return opts.candidates.filter((c) => {
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

  const deps: CronDeps = {
    prisma: { booking: { findMany: findMany as unknown as CronDeps["prisma"]["booking"]["findMany"] } },
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

describe("runBookingEmailsCron — 24h reminder window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  test("picks up booking starting exactly 24h ahead (window upper edge included)", async () => {
    const candidates = [
      row({ id: "edge_top", date: new Date("2026-05-25T00:00:00.000Z"), anchorTime: "10:00" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    const summary = await runBookingEmailsCron(deps);
    expect(recorded.reminderCalls).toEqual(["edge_top"]);
    expect(summary.reminders.sent).toBe(1);
  });

  test("skips booking starting 24h+1min ahead (just past window)", async () => {
    const candidates = [
      row({ id: "too_far", date: new Date("2026-05-25T00:00:00.000Z"), anchorTime: "10:01" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    const summary = await runBookingEmailsCron(deps);
    expect(recorded.reminderCalls).toEqual([]);
    expect(summary.reminders.considered).toBe(0);
  });

  test("skips booking starting 23h ahead (window lower edge excluded — caught next hour)", async () => {
    // window is (now+23h, now+24h] = (09:00 tomorrow, 10:00 tomorrow]
    const candidates = [
      row({ id: "edge_bottom", date: new Date("2026-05-25T00:00:00.000Z"), anchorTime: "09:00" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.reminderCalls).toEqual([]);
  });

  test("picks up booking 23h+1min ahead (one minute inside window)", async () => {
    const candidates = [
      row({ id: "edge_bottom_plus", date: new Date("2026-05-25T00:00:00.000Z"), anchorTime: "09:01" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.reminderCalls).toEqual(["edge_bottom_plus"]);
  });

  test("does NOT re-send when reminder24hSentAt already flipped (idempotency)", async () => {
    const candidates = [
      row({ id: "boot1", date: new Date("2026-05-25T00:00:00.000Z"), anchorTime: "10:00" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    await runBookingEmailsCron(deps);
    expect(recorded.reminderCalls).toEqual(["boot1"]);
  });

  test("dispatches en + de + es locales in same run", async () => {
    const candidates = [
      row({ id: "en_b", date: new Date("2026-05-25T00:00:00.000Z"), anchorTime: "10:00", language: Locale.en }),
      row({ id: "de_b", date: new Date("2026-05-25T00:00:00.000Z"), anchorTime: "10:00", language: Locale.de }),
      row({ id: "es_b", date: new Date("2026-05-25T00:00:00.000Z"), anchorTime: "10:00", language: Locale.es }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.reminderLocales.sort()).toEqual(["de", "en", "es"]);
  });
});

describe("runBookingEmailsCron — T+2h post-class window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  test("picks up booking that ended exactly 2h ago (window upper edge included)", async () => {
    // window for end = (now-3h, now-2h] = (07:00, 08:00]
    // 1h booking starting at 07:00 ends 08:00 — included
    const candidates = [
      row({
        id: "end_edge_top",
        date: new Date("2026-05-24T00:00:00.000Z"),
        anchorTime: "07:00",
        duration: Duration.ONE_HOUR,
      }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    const summary = await runBookingEmailsCron(deps);
    expect(recorded.postClassCalls).toEqual(["end_edge_top"]);
    expect(summary.postClass.sent).toBe(1);
  });

  test("skips booking that ended 1h59min ago (window not reached)", async () => {
    // 1h booking starting 06:01 ends 07:01 — older than 08:00 wait, no:
    // Want endUtc > 08:00 (just after upper edge) to be skipped.
    // anchorTime 07:01 + 1h = 08:01 — skipped because > postClassEnd.
    const candidates = [
      row({
        id: "too_recent",
        date: new Date("2026-05-24T00:00:00.000Z"),
        anchorTime: "07:01",
      }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.postClassCalls).toEqual([]);
  });

  test("skips booking that ended 3h ago (window lower edge excluded)", async () => {
    // anchorTime 06:00 + 1h = 07:00 — equals postClassStart, excluded by `>`.
    const candidates = [
      row({
        id: "end_edge_bottom",
        date: new Date("2026-05-24T00:00:00.000Z"),
        anchorTime: "06:00",
      }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.postClassCalls).toEqual([]);
  });

  test("picks up booking that ended 2h+1min ago (one minute inside window)", async () => {
    const candidates = [
      row({
        id: "end_inside",
        date: new Date("2026-05-24T00:00:00.000Z"),
        anchorTime: "06:59",
      }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.postClassCalls).toEqual(["end_inside"]);
  });

  test("computes endUtc from duration — 2h lesson, not 1h", async () => {
    // 2h lesson starting 06:00 ends 08:00 — at the upper edge, included.
    const candidates = [
      row({
        id: "two_hour",
        date: new Date("2026-05-24T00:00:00.000Z"),
        anchorTime: "06:00",
        duration: Duration.TWO_HOURS,
      }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    expect(recorded.postClassCalls).toEqual(["two_hour"]);
  });

  test("is idempotent — second invocation does not re-call sendPostClass", async () => {
    const candidates = [
      row({
        id: "pc_boot",
        date: new Date("2026-05-24T00:00:00.000Z"),
        anchorTime: "07:00",
      }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    await runBookingEmailsCron(deps);
    await runBookingEmailsCron(deps);
    expect(recorded.postClassCalls).toEqual(["pc_boot"]);
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
      row({ id: "fail_one", date: new Date("2026-05-25T00:00:00.000Z"), anchorTime: "10:00" }),
      row({ id: "ok_two", date: new Date("2026-05-25T00:00:00.000Z"), anchorTime: "10:00" }),
    ];
    const { deps, recorded } = makeDeps({ candidates });
    // Override sendReminder to fail on the first id.
    deps.sendReminder = vi.fn(async (_d, id: string) => {
      if (id === "fail_one") throw new Error("resend boom");
      recorded.reminderCalls.push(id);
      return { ok: true, sent: true, emailId: `e_${id}` };
    }) as CronDeps["sendReminder"];

    // Silence the expected error log.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const summary = await runBookingEmailsCron(deps);
    errSpy.mockRestore();

    expect(recorded.reminderCalls).toEqual(["ok_two"]);
    expect(summary.reminders.sent).toBe(1);
    expect(summary.reminders.errors).toBe(1);
  });
});
