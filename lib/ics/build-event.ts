import { createEvent, type EventAttributes } from "ics";

export type BuildBookingIcsInput = {
  /** Stable RFC 5545 UID; reuse Booking.icsUid so updates replace the event. */
  uid: string;
  title: string;
  /** Class start in UTC. */
  startUtc: Date;
  /** Lesson length in minutes. */
  durationMinutes: number;
  location: string;
  description: string;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
};

export class IcsBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IcsBuildError";
  }
}

/**
 * Build a `text/calendar` payload representing the booking. The output is a
 * UTF-8 string ready to attach to an email (MIME `text/calendar; method=REQUEST`).
 *
 * `uid` MUST be the same value every time we emit the event for this booking —
 * mail clients dedupe by UID, so re-emitting on confirmation + reminder must
 * resolve to the same calendar entry (an update, not a duplicate).
 */
export function buildBookingIcs(input: BuildBookingIcsInput): string {
  const start = toIcsTupleUtc(input.startUtc);
  const attributes: EventAttributes = {
    uid: input.uid,
    title: input.title,
    description: input.description,
    location: input.location,
    start,
    startInputType: "utc",
    startOutputType: "utc",
    duration: { minutes: input.durationMinutes },
    organizer: { name: input.organizerName, email: input.organizerEmail },
    attendees: [
      {
        name: input.attendeeName,
        email: input.attendeeEmail,
        rsvp: true,
        partstat: "NEEDS-ACTION",
        role: "REQ-PARTICIPANT",
      },
    ],
    status: "CONFIRMED",
    productId: "ride-flumserberg/booking",
    method: "REQUEST",
  };

  const { error, value } = createEvent(attributes);
  if (error || !value) {
    throw new IcsBuildError(
      error ? error.message : "ics.createEvent returned an empty payload",
    );
  }
  return value;
}

type IcsDateTuple = [number, number, number, number, number];

function toIcsTupleUtc(date: Date): IcsDateTuple {
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
  ];
}
