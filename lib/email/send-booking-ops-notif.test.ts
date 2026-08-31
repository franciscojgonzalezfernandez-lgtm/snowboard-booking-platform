import { describe, expect, test, vi } from "vitest";
import { Duration } from "@prisma/client";

import { sendEmail, type EmailClient } from "./send-email";
import {
  sendBookingOpsNotifWith,
  type BookingRowForOpsNotif,
  type SendBookingOpsNotifDeps,
} from "./send-booking-ops-notif";

const FIXED_NOW = new Date("2026-12-01T08:00:00.000Z");
const OPS_EMAIL = "franciscojgonzalezfernandez@gmail.com";

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Ride <booking@rideflumserberg.ch>",
};

function makeBooking(
  overrides: Partial<BookingRowForOpsNotif> = {},
): BookingRowForOpsNotif {
  return {
    id: "book_1",
    date: new Date("2026-12-05T00:00:00.000Z"),
    anchorTime: "11:00",
    duration: Duration.ONE_HOUR,
    totalPriceCents: 11_000,
    opsBookingNotifSentAt: null,
    booker: {
      name: "Lara Tester",
      email: "lara@example.test",
      phone: "+41791234567",
    },
    // Default = non-owner instructor → two distinct recipients.
    instructor: { user: { name: "Lara", email: "lara@rideflumserberg.ch" } },
    attendees: [{ id: "att_1" }, { id: "att_2" }],
    ...overrides,
  };
}

function makeDeps(
  overrides: { booking?: BookingRowForOpsNotif | null; emailId?: string } = {},
) {
  const bookingRow = overrides.booking ?? makeBooking();
  const updates: Array<{ id: string; opsBookingNotifSentAt: Date }> = [];
  const findUnique = vi.fn(async () =>
    overrides.booking === null ? null : bookingRow,
  );
  const update = vi.fn(
    async (args: {
      where: { id: string };
      data: { opsBookingNotifSentAt: Date };
    }) => {
      updates.push({
        id: args.where.id,
        opsBookingNotifSentAt: args.data.opsBookingNotifSentAt,
      });
      return { id: args.where.id };
    },
  );
  const client: EmailClient = {
    emails: {
      send: vi.fn<EmailClient["emails"]["send"]>(async () => ({
        data: { id: overrides.emailId ?? "email_ops_123" },
        error: null,
        headers: null,
      })),
    },
  };

  const deps: SendBookingOpsNotifDeps = {
    prisma: {
      booking: { findUnique, update },
    } as unknown as SendBookingOpsNotifDeps["prisma"],
    send: (input, opts) => sendEmail(input, { ...opts, env: baseEnv }),
    emailClient: client,
    now: FIXED_NOW,
  };
  return { deps, updates, client, spies: { findUnique, update } };
}

function firstCall(client: EmailClient): [Record<string, unknown>, unknown] {
  return (
    client.emails.send as unknown as {
      mock: { calls: Array<[Record<string, unknown>, unknown]> };
    }
  ).mock.calls[0]!;
}

describe("sendBookingOpsNotifWith", () => {
  test("sends one email to {instructor, admin} + flips opsBookingNotifSentAt", async () => {
    const { deps, updates, client } = makeDeps();
    const result = await sendBookingOpsNotifWith(deps, "book_1");

    expect(result).toEqual({
      ok: true,
      sent: true,
      emailId: "email_ops_123",
      recipients: ["lara@rideflumserberg.ch", OPS_EMAIL],
    });
    expect(client.emails.send).toHaveBeenCalledTimes(1);
    const [payload, opts] = firstCall(client);
    expect(payload.to).toEqual(["lara@rideflumserberg.ch", OPS_EMAIL]);
    expect((opts as { idempotencyKey?: string }).idempotencyKey).toBe(
      "booking-ops-notif-book_1",
    );
    expect(payload.tags).toEqual(
      expect.arrayContaining([
        { name: "kind", value: "booking-ops-notif" },
        { name: "locale", value: "en" },
      ]),
    );
    expect(updates).toEqual([
      { id: "book_1", opsBookingNotifSentAt: FIXED_NOW },
    ]);
  });

  test("dedupes to a single recipient when the instructor IS the admin", async () => {
    // Owner teaches his own lesson, with different casing → still one email.
    const { deps, client } = makeDeps({
      booking: makeBooking({
        instructor: {
          user: { name: "Javi", email: "FranciscoJGonzalezFernandez@gmail.com" },
        },
      }),
    });
    const result = await sendBookingOpsNotifWith(deps, "book_1");
    expect(result).toMatchObject({
      sent: true,
      recipients: ["FranciscoJGonzalezFernandez@gmail.com"],
    });
    const [payload] = firstCall(client);
    expect(payload.to).toEqual(["FranciscoJGonzalezFernandez@gmail.com"]);
  });

  test("subject + body carry the booking details, always in English", async () => {
    const { deps, client } = makeDeps();
    await sendBookingOpsNotifWith(deps, "book_1");
    const [payload] = firstCall(client);
    expect(payload.subject as string).toContain("New booking");
    const text = payload.text as string;
    expect(text).toContain("Lara Tester");
    expect(text).toContain("lara@example.test");
    expect(text).toContain("Phone: +41791234567");
    // formatChf (de-CH) separates "CHF" from the amount with a non-breaking
    // space, so assert on the amount alone to stay robust to that codepoint.
    expect(text).toContain("110.00");
    expect(text).toContain("2 riders");
  });

  test("omits the phone line when the booker has none on file", async () => {
    const { deps, client } = makeDeps({
      booking: makeBooking({
        booker: { name: "No Phone", email: "nophone@example.test", phone: null },
      }),
    });
    await sendBookingOpsNotifWith(deps, "book_1");
    const [payload] = firstCall(client);
    expect(payload.text as string).not.toContain("Phone:");
  });

  test("is idempotent — second invocation returns ALREADY_SENT, no send", async () => {
    const { deps, client } = makeDeps({
      booking: makeBooking({
        opsBookingNotifSentAt: new Date("2026-12-01T07:00:00.000Z"),
      }),
    });
    const result = await sendBookingOpsNotifWith(deps, "book_1");
    expect(result).toEqual({ ok: true, sent: false, reason: "ALREADY_SENT" });
    expect(client.emails.send).not.toHaveBeenCalled();
  });

  test("returns BOOKING_NOT_FOUND when no row matches the id", async () => {
    const { deps, client } = makeDeps({ booking: null });
    const result = await sendBookingOpsNotifWith(deps, "missing");
    expect(result).toEqual({ ok: false, error: "BOOKING_NOT_FOUND" });
    expect(client.emails.send).not.toHaveBeenCalled();
  });
});
