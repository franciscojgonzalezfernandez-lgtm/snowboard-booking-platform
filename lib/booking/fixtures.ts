import { BookingStatus, Duration } from "@prisma/client";

// Shared test fixtures for the booking-policy suites (F-086f), following the
// lib/booking-engine/fixtures.ts precedent. The type is the superset of the
// fields the cancel / cancel-by-ops / resume-payment cores read; each suite
// wraps makeBookingFixture() with its own defaults so test semantics stay
// exactly as before the consolidation. lib/calendar/sync.test.ts keeps a local
// relation-shaped fixture on purpose — it feeds a different module boundary
// (booker/instructor relations loaded for Google Calendar sync).

/** Reference clock used by the cancel-policy suites: 10 days before the
 * default class start (2026-12-11 08:00Z), comfortably past the 48h window. */
export const FIXED_NOW = new Date("2026-12-01T08:00:00.000Z");

export type BookingFixture = {
  id: string;
  bookerId: string;
  instructorId: string;
  status: BookingStatus;
  date: Date;
  anchorTime: string;
  duration: Duration;
  totalPriceCents: number;
  chargeAmountCents: number | null;
  creditsAppliedCents: number | null;
  stripePaymentIntentId: string | null;
  paidAt: Date | null;
  stripeRefundId: string | null;
  createdAt: Date;
};

export function makeBookingFixture(
  overrides: Partial<BookingFixture> = {},
): BookingFixture {
  return {
    id: "book_1",
    bookerId: "user_owner",
    instructorId: "inst_1",
    status: BookingStatus.CONFIRMED,
    // 10 days out from FIXED_NOW → comfortably ≥48h before class start.
    date: new Date("2026-12-11T00:00:00.000Z"),
    anchorTime: "08:00",
    duration: Duration.ONE_HOUR,
    totalPriceCents: 11000,
    chargeAmountCents: null,
    creditsAppliedCents: null,
    stripePaymentIntentId: null,
    paidAt: null,
    stripeRefundId: null,
    createdAt: new Date("2026-11-30T08:00:00.000Z"),
    ...overrides,
  };
}
