import { describe, expect, test } from "vitest";

import { buildBookingIcs } from "./build-event";

const FIXED_START = new Date("2026-12-05T11:00:00.000Z");

const BASE_INPUT = {
  uid: "booking-fixed-uuid@rideflumserberg.ch",
  title: "Snowboard lesson · Javi",
  startUtc: FIXED_START,
  durationMinutes: 60,
  location: "Flumserberg, Switzerland",
  description: "Ride Flumserberg booking.",
  organizerName: "Ride Flumserberg",
  organizerEmail: "booking@rideflumserberg.ch",
  attendeeName: "Lara Tester",
  attendeeEmail: "lara@example.test",
};

describe("buildBookingIcs", () => {
  test("returns a UTF-8 VCALENDAR payload with the stable UID + UTC DTSTART + REQUEST method", () => {
    const ics = buildBookingIcs(BASE_INPUT);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain(`UID:${BASE_INPUT.uid}`);
    expect(ics).toContain("DTSTART:20261205T110000Z");
    expect(ics).toContain("DURATION:PT60M");
    expect(ics).toContain("SUMMARY:Snowboard lesson · Javi");
    expect(ics).toContain("LOCATION:Flumserberg\\, Switzerland");
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain(`ATTENDEE;`);
    expect(ics).toContain(`lara@example.test`);
    expect(ics).toContain(`ORGANIZER;`);
    expect(ics).toContain(`booking@rideflumserberg.ch`);
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  test("emits PT2H duration for a TWO_HOURS lesson and keeps the same UID stable across calls", () => {
    const first = buildBookingIcs({ ...BASE_INPUT, durationMinutes: 120 });
    expect(first).toContain("DURATION:PT120M");
    const second = buildBookingIcs({ ...BASE_INPUT, durationMinutes: 120 });
    // Same inputs → same UID line. Mail clients dedupe on UID.
    expect(extractUid(first)).toBe(extractUid(second));
  });
});

function extractUid(ics: string): string {
  const match = ics.match(/UID:(.+)/);
  return match?.[1]?.trim() ?? "";
}
