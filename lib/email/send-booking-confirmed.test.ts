import { describe, expect, test, vi } from "vitest";
import { Duration, Locale } from "@prisma/client";

import { sendEmail, type EmailClient } from "./send-email";
import {
  sendBookingConfirmedEmailWith,
  type BookingRowForEmail,
  type SendBookingConfirmedDeps,
} from "./send-booking-confirmed";

const FIXED_NOW = new Date("2026-12-01T08:00:00.000Z");

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Ride <booking@rideflumserberg.ch>",
};

function makeBooking(
  overrides: Partial<BookingRowForEmail> = {},
): BookingRowForEmail {
  return {
    id: "book_1",
    date: new Date("2026-12-05T00:00:00.000Z"),
    anchorTime: "11:00",
    duration: Duration.ONE_HOUR,
    language: Locale.en,
    totalPriceCents: 11000,
    icsUid: "booking-fixed-uuid@rideflumserberg.ch",
    confirmationEmailSentAt: null,
    booker: { name: "Lara Tester", email: "lara@example.test" },
    instructor: { user: { name: "Javi" } },
    attendees: [{ id: "att_1" }],
    ...overrides,
  };
}

function makeDeps(
  overrides: {
    booking?: BookingRowForEmail | null;
    emailId?: string;
  } = {},
) {
  const bookingRow = overrides.booking ?? makeBooking();
  const updates: Array<{ id: string; confirmationEmailSentAt: Date }> = [];
  const findUnique = vi.fn(async () =>
    overrides.booking === null ? null : bookingRow,
  );
  const update = vi.fn(
    async (args: {
      where: { id: string };
      data: { confirmationEmailSentAt: Date };
    }) => {
      updates.push({
        id: args.where.id,
        confirmationEmailSentAt: args.data.confirmationEmailSentAt,
      });
      return { id: args.where.id };
    },
  );
  const client: EmailClient = {
    emails: {
      send: vi.fn<EmailClient["emails"]["send"]>(async () => ({
        data: { id: overrides.emailId ?? "email_test_123" },
        error: null,
        headers: null,
      })),
    },
  };

  const deps: SendBookingConfirmedDeps = {
    prisma: {
      booking: {
        findUnique: findUnique as unknown as SendBookingConfirmedDeps["prisma"]["booking"]["findUnique"],
        update,
      },
    },
    send: (input, opts) => sendEmail(input, { ...opts, env: baseEnv }),
    emailClient: client,
    now: FIXED_NOW,
  };
  return { deps, updates, client, spies: { findUnique, update } };
}

describe("sendBookingConfirmedEmailWith", () => {
  test("sends a confirmation email + flips confirmationEmailSentAt", async () => {
    const { deps, updates, client } = makeDeps();
    const result = await sendBookingConfirmedEmailWith(deps, "book_1");
    expect(result).toEqual({
      ok: true,
      sent: true,
      emailId: "email_test_123",
    });
    expect(client.emails.send).toHaveBeenCalledTimes(1);
    expect(updates).toEqual([
      { id: "book_1", confirmationEmailSentAt: FIXED_NOW },
    ]);
  });

  test("attaches an ics calendar invite with the stable booking UID", async () => {
    const { deps, client } = makeDeps();
    await sendBookingConfirmedEmailWith(deps, "book_1");
    const call = (
      client.emails.send as unknown as {
        mock: { calls: Array<[Record<string, unknown>, unknown]> };
      }
    ).mock.calls[0]!;
    const payload = call[0];
    const attachments = payload.attachments as Array<{
      filename: string;
      content: string;
      contentType: string;
    }>;
    expect(attachments).toHaveLength(1);
    const att = attachments[0]!;
    expect(att.filename).toBe("booking.ics");
    expect(att.contentType).toContain("text/calendar");
    const decoded = Buffer.from(att.content, "base64").toString("utf8");
    expect(decoded).toContain("UID:booking-fixed-uuid@rideflumserberg.ch");
    // anchorTime "11:00" is Europe/Zurich; 2026-12-05 is winter (CET, UTC+1), so
    // the absolute DTSTART is 10:00Z. Asserting 11:00Z here would re-introduce
    // the +1h offset bug (the event displaying an hour late in mail clients).
    expect(decoded).toContain("DTSTART:20261205T100000Z");
  });

  test("is idempotent — second invocation returns ALREADY_SENT and does not call Resend", async () => {
    const { deps, client } = makeDeps({
      booking: makeBooking({
        confirmationEmailSentAt: new Date("2026-12-01T07:00:00.000Z"),
      }),
    });
    const result = await sendBookingConfirmedEmailWith(deps, "book_1");
    expect(result).toEqual({
      ok: true,
      sent: false,
      reason: "ALREADY_SENT",
    });
    expect(client.emails.send).not.toHaveBeenCalled();
  });

  test("returns BOOKING_NOT_FOUND when no row matches the id", async () => {
    const { deps, client } = makeDeps({ booking: null });
    const result = await sendBookingConfirmedEmailWith(deps, "book_missing");
    expect(result).toEqual({ ok: false, error: "BOOKING_NOT_FOUND" });
    expect(client.emails.send).not.toHaveBeenCalled();
  });

  test("routes the subject + locale tag for de bookings", async () => {
    const { deps, client } = makeDeps({
      booking: makeBooking({ language: Locale.de }),
    });
    await sendBookingConfirmedEmailWith(deps, "book_1");
    const call = (
      client.emails.send as unknown as {
        mock: { calls: Array<[Record<string, unknown>, unknown]> };
      }
    ).mock.calls[0]!;
    const payload = call[0];
    expect(payload.subject as string).toContain("gebucht");
    expect(payload.tags).toEqual(
      expect.arrayContaining([{ name: "locale", value: "de" }]),
    );
  });

  test("routes the subject + locale tag for es bookings", async () => {
    const { deps, client } = makeDeps({
      booking: makeBooking({ language: Locale.es }),
    });
    await sendBookingConfirmedEmailWith(deps, "book_1");
    const call = (
      client.emails.send as unknown as {
        mock: { calls: Array<[Record<string, unknown>, unknown]> };
      }
    ).mock.calls[0]!;
    const payload = call[0];
    expect(payload.subject as string).toContain("reservada");
    expect(payload.tags).toEqual(
      expect.arrayContaining([{ name: "locale", value: "es" }]),
    );
  });
});
