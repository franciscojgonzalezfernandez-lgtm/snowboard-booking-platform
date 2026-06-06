import { describe, expect, test, vi } from "vitest";
import { BookingStatus, Duration } from "@prisma/client";

import {
  deleteEventWith,
  insertEventWith,
  type CalendarSyncDeps,
  type GoogleCalendarClient,
} from "./sync";
import { InvalidGrantError } from "./google-oauth";

type BookingFixture = {
  id: string;
  status: BookingStatus;
  date: Date;
  anchorTime: string;
  duration: Duration;
  googleEventId: string | null;
  booker: { name: string | null; email: string };
  instructor: {
    id: string;
    calendarConnected: boolean;
    googleRefreshToken: string | null;
  };
};

function makeBooking(overrides: Partial<BookingFixture> = {}): BookingFixture {
  return {
    id: "book_1",
    status: BookingStatus.CONFIRMED,
    date: new Date("2026-12-11T00:00:00.000Z"),
    anchorTime: "08:00",
    duration: Duration.TWO_HOURS,
    googleEventId: null,
    booker: { name: "Ada Booker", email: "ada@example.com" },
    instructor: {
      id: "inst_1",
      calendarConnected: true,
      googleRefreshToken: "enc:refresh",
    },
    ...overrides,
  };
}

type Captured = {
  bookingUpdate: Array<{ id: string; googleEventId: string | null }>;
  instructorUpdate: Array<{ id: string }>;
};

function makeDeps(
  booking: BookingFixture | null,
  calendar: GoogleCalendarClient,
  overrides: Partial<CalendarSyncDeps> = {},
): { deps: CalendarSyncDeps; captured: Captured; onError: ReturnType<typeof vi.fn> } {
  const captured: Captured = { bookingUpdate: [], instructorUpdate: [] };
  const onError = vi.fn();
  const deps: CalendarSyncDeps = {
    prisma: {
      booking: {
        findUnique: async () => booking as never,
        update: async ({ where, data }) => {
          captured.bookingUpdate.push({
            id: where.id,
            googleEventId: data.googleEventId,
          });
          return { id: where.id };
        },
      },
      instructor: {
        update: async ({ where }) => {
          captured.instructorUpdate.push({ id: where.id });
          return { id: where.id };
        },
      },
    },
    calendar,
    // Identity decrypt + a stub refresh so no real Google/AES is touched.
    decrypt: (payload) => payload,
    refreshAccessToken: async () => "access_token_xyz",
    onError,
    ...overrides,
  };
  return { deps, captured, onError };
}

function noopCalendar(): GoogleCalendarClient {
  return {
    insert: vi.fn(async () => ({ id: "evt_new" })),
    remove: vi.fn(async () => {}),
  };
}

describe("insertEventWith", () => {
  test("inserts the event and persists googleEventId", async () => {
    const calendar = noopCalendar();
    const { deps, captured } = makeDeps(makeBooking(), calendar);

    const result = await insertEventWith(deps, "book_1");

    expect(result).toEqual({ status: "synced", eventId: "evt_new" });
    expect(calendar.insert).toHaveBeenCalledTimes(1);
    // start 08:00 UTC, TWO_HOURS → 10:00 UTC; booker carried as attendee.
    const [, payload] = (calendar.insert as ReturnType<typeof vi.fn>).mock
      .calls[0]!;
    expect(payload.startDateTimeUtc).toBe("2026-12-11T08:00:00.000Z");
    expect(payload.endDateTimeUtc).toBe("2026-12-11T10:00:00.000Z");
    expect(payload.timeZone).toBe("Europe/Zurich");
    expect(payload.attendeeEmail).toBe("ada@example.com");
    expect(captured.bookingUpdate).toEqual([
      { id: "book_1", googleEventId: "evt_new" },
    ]);
  });

  test("is idempotent: a row that already has an event id is skipped", async () => {
    const calendar = noopCalendar();
    const { deps, captured } = makeDeps(
      makeBooking({ googleEventId: "evt_existing" }),
      calendar,
    );

    const result = await insertEventWith(deps, "book_1");

    expect(result).toEqual({ status: "skipped", reason: "already_synced" });
    expect(calendar.insert).not.toHaveBeenCalled();
    expect(captured.bookingUpdate).toEqual([]);
  });

  test("skips when the booking is not CONFIRMED", async () => {
    const calendar = noopCalendar();
    const { deps } = makeDeps(
      makeBooking({ status: BookingStatus.PENDING_PAYMENT }),
      calendar,
    );

    const result = await insertEventWith(deps, "book_1");

    expect(result).toEqual({ status: "skipped", reason: "not_confirmed" });
    expect(calendar.insert).not.toHaveBeenCalled();
  });

  test("skips when the instructor calendar is not connected", async () => {
    const calendar = noopCalendar();
    const { deps } = makeDeps(
      makeBooking({
        instructor: {
          id: "inst_1",
          calendarConnected: false,
          googleRefreshToken: null,
        },
      }),
      calendar,
    );

    const result = await insertEventWith(deps, "book_1");

    expect(result).toEqual({ status: "skipped", reason: "not_connected" });
    expect(calendar.insert).not.toHaveBeenCalled();
  });

  test("skips when the booking is not found", async () => {
    const calendar = noopCalendar();
    const { deps } = makeDeps(null, calendar);

    const result = await insertEventWith(deps, "missing");

    expect(result).toEqual({ status: "skipped", reason: "not_found" });
  });

  test("invalid_grant disconnects the instructor and reports", async () => {
    const calendar = noopCalendar();
    const { deps, captured, onError } = makeDeps(makeBooking(), calendar, {
      refreshAccessToken: async () => {
        throw new InvalidGrantError();
      },
    });

    const result = await insertEventWith(deps, "book_1");

    expect(result).toEqual({ status: "disconnected" });
    expect(captured.instructorUpdate).toEqual([{ id: "inst_1" }]);
    expect(calendar.insert).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("a Calendar API failure is reported and never throws", async () => {
    const calendar: GoogleCalendarClient = {
      insert: vi.fn(async () => {
        throw new Error("Google Calendar event insert failed: 500");
      }),
      remove: vi.fn(async () => {}),
    };
    const { deps, captured, onError } = makeDeps(makeBooking(), calendar);

    const result = await insertEventWith(deps, "book_1");

    expect(result).toEqual({ status: "error" });
    expect(captured.bookingUpdate).toEqual([]);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("deleteEventWith", () => {
  test("removes the event and nulls googleEventId", async () => {
    const calendar = noopCalendar();
    const { deps, captured } = makeDeps(
      makeBooking({ googleEventId: "evt_existing" }),
      calendar,
    );

    const result = await deleteEventWith(deps, "book_1");

    expect(result).toEqual({ status: "removed" });
    expect(calendar.remove).toHaveBeenCalledWith(
      "access_token_xyz",
      "evt_existing",
    );
    expect(captured.bookingUpdate).toEqual([
      { id: "book_1", googleEventId: null },
    ]);
  });

  test("no-ops when the booking has no synced event", async () => {
    const calendar = noopCalendar();
    const { deps } = makeDeps(
      makeBooking({ googleEventId: null }),
      calendar,
    );

    const result = await deleteEventWith(deps, "book_1");

    expect(result).toEqual({ status: "skipped", reason: "no_event" });
    expect(calendar.remove).not.toHaveBeenCalled();
  });

  test("skips when the instructor calendar is no longer connected", async () => {
    const calendar = noopCalendar();
    const { deps } = makeDeps(
      makeBooking({
        googleEventId: "evt_existing",
        instructor: {
          id: "inst_1",
          calendarConnected: false,
          googleRefreshToken: null,
        },
      }),
      calendar,
    );

    const result = await deleteEventWith(deps, "book_1");

    expect(result).toEqual({ status: "skipped", reason: "not_connected" });
    expect(calendar.remove).not.toHaveBeenCalled();
  });

  test("invalid_grant disconnects the instructor and reports", async () => {
    const calendar = noopCalendar();
    const { deps, captured, onError } = makeDeps(
      makeBooking({ googleEventId: "evt_existing" }),
      calendar,
      {
        refreshAccessToken: async () => {
          throw new InvalidGrantError();
        },
      },
    );

    const result = await deleteEventWith(deps, "book_1");

    expect(result).toEqual({ status: "disconnected" });
    expect(captured.instructorUpdate).toEqual([{ id: "inst_1" }]);
    expect(calendar.remove).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
