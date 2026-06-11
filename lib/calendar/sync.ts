import { BookingStatus, type Duration } from "@prisma/client";

import { durationMinutes } from "@/lib/booking-engine/duration";
import { setUtcTime, startOfUtcDay } from "@/lib/booking-engine/time";

import { decryptToken } from "./crypto";
import {
  InvalidGrantError,
  refreshAccessToken as realRefreshAccessToken,
} from "./google-oauth";

// F-075: one-way sync of a booking into the instructor's *own* Google Calendar
// so the slot is visibly blocked in their personal calendar. Best-effort by
// contract: a Google failure never rolls back the booking/cancel that triggered
// it (the callers wrap these in try/catch + onError). We talk to the Calendar v3
// REST API directly (no `googleapis` dep), mirroring lib/calendar/google-oauth.ts.

const EVENTS_ENDPOINT =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const EVENT_TIME_ZONE = "Europe/Zurich";
const EVENT_LOCATION = "Flumserberg, Switzerland";

const DURATION_LABEL: Record<Duration, string> = {
  ONE_HOUR: "1 hour",
  TWO_HOURS: "2 hours",
  INTENSIVE: "4 hours · intensive",
  FULL_DAY: "6 hours · full day",
};

/** Calendar-event shape passed to {@link GoogleCalendarClient.insert}. Times are
 * *floating* local wall-clock with no offset (e.g. `2026-11-30T12:00:00`) paired
 * with `timeZone`; Google resolves the instant in that zone. anchorTime is a
 * naive Europe/Zurich wall-clock everywhere in the app, so we must NOT stamp it
 * as UTC (`…Z`) here — that read 12:00 as UTC and displayed every event shifted
 * by the Zurich offset (13:00 in winter). */
export type CalendarEventPayload = {
  summary: string;
  description: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  /** Always null: F-075 mirrors the lesson into the *instructor's* own calendar
   * to block the slot. Adding the booker as an attendee surfaced the lesson on
   * the client's personal calendar (not intended) — the booker gets their own
   * copy via the .ics confirmation email. Kept nullable for a future opt-in. */
  attendeeEmail: string | null;
};

/** Narrowed Calendar API surface — injected so unit tests drive the sync logic
 * without hitting Google. Production wires {@link googleCalendarRestClient}. */
export type GoogleCalendarClient = {
  insert(
    accessToken: string,
    event: CalendarEventPayload,
  ): Promise<{ id: string }>;
  remove(accessToken: string, eventId: string): Promise<void>;
};

type BookingRowForSync = {
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

const BOOKING_SELECT = {
  id: true,
  status: true,
  date: true,
  anchorTime: true,
  duration: true,
  googleEventId: true,
  booker: { select: { name: true, email: true } },
  instructor: {
    select: { id: true, calendarConnected: true, googleRefreshToken: true },
  },
} as const;

type PrismaSurface = {
  booking: {
    findUnique(args: {
      where: { id: string };
      select: typeof BOOKING_SELECT;
    }): Promise<BookingRowForSync | null>;
    update(args: {
      where: { id: string };
      data: { googleEventId: string | null };
    }): Promise<{ id: string }>;
  };
  instructor: {
    update(args: {
      where: { id: string };
      data: { calendarConnected: false; googleRefreshToken: null };
    }): Promise<{ id: string }>;
  };
};

export type CalendarSyncDeps = {
  prisma: PrismaSurface;
  calendar: GoogleCalendarClient;
  /** Mint an access token from the refresh token. Defaults to the real Google
   * `refresh_token` grant; tests inject a stub (and an `InvalidGrantError`
   * thrower to exercise the disconnect path). */
  refreshAccessToken?: (refreshToken: string) => Promise<string>;
  /** Decrypt the at-rest refresh token (ADR-007). Defaults to the real AES-GCM
   * `decryptToken`; tests inject identity. */
  decrypt?: (payload: string) => string;
  /** Sentry-shaped sink for observability; best-effort failures land here. */
  onError?: (err: unknown, ctx: Record<string, unknown>) => void;
};

export type CalendarSyncResult =
  | { status: "synced"; eventId: string }
  | { status: "removed" }
  | {
      status: "skipped";
      reason:
        | "not_found"
        | "not_confirmed"
        | "already_synced"
        | "not_connected"
        | "no_event";
    }
  | { status: "disconnected" }
  | { status: "error" };

/** True when the instructor has a usable, connected calendar. */
function instructorCanSync(instructor: BookingRowForSync["instructor"]): boolean {
  return instructor.calendarConnected && instructor.googleRefreshToken !== null;
}

/**
 * Drop the instructor's calendar connection after Google reports the refresh
 * token is dead (`invalid_grant`): clear the encrypted token + flag so the UI
 * shows "disconnected" and we stop retrying a token that will never work again.
 */
async function disconnectCalendar(
  deps: CalendarSyncDeps,
  instructorId: string,
  err: unknown,
  stage: string,
  bookingId: string,
): Promise<void> {
  deps.onError?.(err, { stage, bookingId, instructorId, reason: "invalid_grant" });
  await deps.prisma.instructor.update({
    where: { id: instructorId },
    data: { calendarConnected: false, googleRefreshToken: null },
  });
}

/**
 * Insert a CONFIRMED booking as an event in the instructor's Google Calendar
 * and persist `Booking.googleEventId`. Idempotent: a row that already carries
 * an event id is skipped (a Stripe webhook retry never double-inserts).
 *
 * Skips silently (returns a `skipped`/`disconnected` result, never throws) when
 * the instructor has no connected calendar or the booking isn't CONFIRMED — the
 * caller treats this as best-effort.
 */
export async function insertEventWith(
  deps: CalendarSyncDeps,
  bookingId: string,
): Promise<CalendarSyncResult> {
  const refresh = deps.refreshAccessToken ?? realRefreshAccessToken;
  const decrypt = deps.decrypt ?? decryptToken;

  const booking = await deps.prisma.booking.findUnique({
    where: { id: bookingId },
    select: BOOKING_SELECT,
  });
  if (!booking) return { status: "skipped", reason: "not_found" };
  if (booking.status !== BookingStatus.CONFIRMED) {
    return { status: "skipped", reason: "not_confirmed" };
  }
  if (booking.googleEventId !== null) {
    return { status: "skipped", reason: "already_synced" };
  }
  if (!instructorCanSync(booking.instructor)) {
    return { status: "skipped", reason: "not_connected" };
  }

  let accessToken: string;
  try {
    accessToken = await refresh(decrypt(booking.instructor.googleRefreshToken!));
  } catch (err) {
    if (err instanceof InvalidGrantError) {
      await disconnectCalendar(
        deps,
        booking.instructor.id,
        err,
        "gcal_insert",
        bookingId,
      );
      return { status: "disconnected" };
    }
    deps.onError?.(err, { stage: "gcal_insert", bookingId });
    return { status: "error" };
  }

  try {
    const { id } = await deps.calendar.insert(
      accessToken,
      buildEventPayload(booking),
    );
    await deps.prisma.booking.update({
      where: { id: bookingId },
      data: { googleEventId: id },
    });
    return { status: "synced", eventId: id };
  } catch (err) {
    deps.onError?.(err, { stage: "gcal_insert", bookingId });
    return { status: "error" };
  }
}

/**
 * Delete the booking's calendar event (on cancel) and null out
 * `Booking.googleEventId`. Idempotent: a row with no event id is a no-op, and
 * the REST client treats an already-gone event (404/410) as success.
 */
export async function deleteEventWith(
  deps: CalendarSyncDeps,
  bookingId: string,
): Promise<CalendarSyncResult> {
  const refresh = deps.refreshAccessToken ?? realRefreshAccessToken;
  const decrypt = deps.decrypt ?? decryptToken;

  const booking = await deps.prisma.booking.findUnique({
    where: { id: bookingId },
    select: BOOKING_SELECT,
  });
  if (!booking) return { status: "skipped", reason: "not_found" };
  if (booking.googleEventId === null) {
    return { status: "skipped", reason: "no_event" };
  }
  if (!instructorCanSync(booking.instructor)) {
    // Can't reach Google to delete — leave the (now stale) event id so a future
    // reconnect could reconcile it. Nothing else to do.
    return { status: "skipped", reason: "not_connected" };
  }

  let accessToken: string;
  try {
    accessToken = await refresh(decrypt(booking.instructor.googleRefreshToken!));
  } catch (err) {
    if (err instanceof InvalidGrantError) {
      await disconnectCalendar(
        deps,
        booking.instructor.id,
        err,
        "gcal_delete",
        bookingId,
      );
      return { status: "disconnected" };
    }
    deps.onError?.(err, { stage: "gcal_delete", bookingId });
    return { status: "error" };
  }

  try {
    await deps.calendar.remove(accessToken, booking.googleEventId);
    await deps.prisma.booking.update({
      where: { id: bookingId },
      data: { googleEventId: null },
    });
    return { status: "removed" };
  } catch (err) {
    deps.onError?.(err, { stage: "gcal_delete", bookingId });
    return { status: "error" };
  }
}

function buildEventPayload(booking: BookingRowForSync): CalendarEventPayload {
  const startUtc = setUtcTime(startOfUtcDay(booking.date), booking.anchorTime);
  const endUtc = new Date(
    startUtc.getTime() + durationMinutes(booking.duration) * 60_000,
  );
  const bookerName = booking.booker.name ?? "Guest";
  return {
    summary: `Snowboard lesson — ${bookerName}`,
    description: `${DURATION_LABEL[booking.duration]} lesson.\nBooker: ${bookerName} <${booking.booker.email}>`,
    location: EVENT_LOCATION,
    startDateTime: toFloatingLocal(startUtc),
    endDateTime: toFloatingLocal(endUtc),
    timeZone: EVENT_TIME_ZONE,
    // Instructor calendar only — see CalendarEventPayload.attendeeEmail.
    attendeeEmail: null,
  };
}

/** Format a wall-clock Date's UTC-container fields as a floating local datetime
 * (`YYYY-MM-DDTHH:MM:SS`, no offset). anchorTime is stored as a naive
 * Europe/Zurich wall-clock inside a UTC-typed Date; emitting it with a `Z` would
 * make Google read it as UTC and display it shifted by the Zurich offset. */
function toFloatingLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(
    d.getUTCDate(),
  )}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00`;
}

/**
 * Production Google Calendar v3 client over `fetch`. The event carries no
 * attendees (instructor-calendar mirror only), so `sendUpdates=none` is just
 * belt-and-suspenders against Google emailing anyone. The booker gets their own
 * copy via the .ics confirmation email (F-045).
 */
export const googleCalendarRestClient: GoogleCalendarClient = {
  async insert(accessToken, event) {
    const res = await fetch(`${EVENTS_ENDPOINT}?sendUpdates=none`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.startDateTime, timeZone: event.timeZone },
        end: { dateTime: event.endDateTime, timeZone: event.timeZone },
        ...(event.attendeeEmail
          ? { attendees: [{ email: event.attendeeEmail }] }
          : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Google Calendar event insert failed: ${res.status}`);
    }
    const json = (await res.json()) as { id: string };
    return { id: json.id };
  },
  async remove(accessToken, eventId) {
    const res = await fetch(
      `${EVENTS_ENDPOINT}/${encodeURIComponent(eventId)}?sendUpdates=none`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );
    // Already deleted on Google's side (or never fully created): treat as done.
    if (res.status === 404 || res.status === 410) return;
    if (!res.ok) {
      throw new Error(`Google Calendar event delete failed: ${res.status}`);
    }
  },
};

/**
 * Build production sync deps from the real Prisma client + REST calendar client.
 * Call sites (Stripe webhook, cancel actions) pass their own `prisma` + an
 * `onError` sink so this module never imports `next/*` and stays unit-testable.
 */
export function buildCalendarSyncDeps(
  prisma: unknown,
  onError?: (err: unknown, ctx: Record<string, unknown>) => void,
): CalendarSyncDeps {
  return {
    prisma: prisma as PrismaSurface,
    calendar: googleCalendarRestClient,
    onError,
  };
}
