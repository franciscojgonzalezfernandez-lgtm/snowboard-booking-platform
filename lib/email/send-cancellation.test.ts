import { describe, expect, test, vi } from "vitest";
import { Duration, Locale } from "@prisma/client";

import { sendEmail, type EmailClient } from "./send-email";
import {
  sendCancellationEmailsWith,
  type BookingRowForCancellation,
  type CancellationDispatchArgs,
  type SendCancellationDeps,
} from "./send-cancellation";

const FIXED_NOW = new Date("2026-12-01T08:00:00.000Z");

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Ride <booking@rideflumserberg.ch>",
};

function makeBooking(
  overrides: Partial<BookingRowForCancellation> = {},
): BookingRowForCancellation {
  return {
    id: "book_1",
    date: new Date("2026-12-05T00:00:00.000Z"),
    anchorTime: "11:00",
    duration: Duration.ONE_HOUR,
    language: Locale.en,
    cancellationEmailSentAt: null,
    opsCancellationNotifSentAt: null,
    booker: { name: "Lara Tester", email: "lara@example.test" },
    instructor: { user: { name: "Javi" } },
    attendees: [{ id: "att_1" }, { id: "att_2" }],
    ...overrides,
  };
}

type SendCall = [
  Record<string, unknown>,
  { idempotencyKey?: string } | undefined,
];

function makeDeps(
  overrides: {
    booking?: BookingRowForCancellation | null;
    bookerEmailId?: string;
    opsEmailId?: string;
  } = {},
) {
  const bookingRow = overrides.booking ?? makeBooking();
  const updates: Array<{
    id: string;
    cancellationEmailSentAt?: Date;
    opsCancellationNotifSentAt?: Date;
  }> = [];
  const findUnique = vi.fn(async () =>
    overrides.booking === null ? null : bookingRow,
  );
  const update = vi.fn(
    async (args: {
      where: { id: string };
      data: {
        cancellationEmailSentAt?: Date;
        opsCancellationNotifSentAt?: Date;
      };
    }) => {
      updates.push({ id: args.where.id, ...args.data });
      return { id: args.where.id };
    },
  );

  let callCount = 0;
  const sendImpl = vi.fn(async () => {
    callCount += 1;
    const isBooker = callCount === 1;
    return {
      data: {
        id: isBooker
          ? (overrides.bookerEmailId ?? "email_booker_123")
          : (overrides.opsEmailId ?? "email_ops_456"),
      },
      error: null,
      headers: null,
    };
  });

  const client: EmailClient = {
    emails: { send: sendImpl as unknown as EmailClient["emails"]["send"] },
  };

  const deps: SendCancellationDeps = {
    prisma: {
      booking: { findUnique, update },
    } as unknown as SendCancellationDeps["prisma"],
    send: (input, opts) => sendEmail(input, { ...opts, env: baseEnv }),
    emailClient: client,
    now: FIXED_NOW,
  };
  return { deps, updates, client, spies: { findUnique, update, sendImpl } };
}

function callsOf(client: EmailClient): SendCall[] {
  return (
    client.emails.send as unknown as {
      mock: { calls: SendCall[] };
    }
  ).mock.calls;
}

describe("sendCancellationEmailsWith — credit variant", () => {
  const creditArgs: CancellationDispatchArgs = {
    bookingId: "book_1",
    variant: "credit",
    hoursBeforeStart: 96,
    creditAmountCents: 11_000,
    creditExpiresAt: new Date("2027-12-05T00:00:00.000Z"),
  };

  test("sends booker credit email + ops notif and flips both timestamps", async () => {
    const { deps, updates, client } = makeDeps();
    const result = await sendCancellationEmailsWith(deps, creditArgs);

    expect(result).toEqual({
      ok: true,
      booker: { sent: true, emailId: "email_booker_123" },
      ops: { sent: true, emailId: "email_ops_456" },
    });
    expect(client.emails.send).toHaveBeenCalledTimes(2);
    expect(updates).toEqual([
      {
        id: "book_1",
        cancellationEmailSentAt: FIXED_NOW,
        opsCancellationNotifSentAt: FIXED_NOW,
      },
    ]);
  });

  test("idempotencyKey + recipient match the spec (credit variant)", async () => {
    const { deps, client } = makeDeps();
    await sendCancellationEmailsWith(deps, creditArgs);
    const calls = callsOf(client);

    expect(calls[0]![0].to).toBe("lara@example.test");
    expect(calls[0]![1]?.idempotencyKey).toBe("cancel-book_1-credit-booker");
    expect(calls[0]![0].tags).toEqual(
      expect.arrayContaining([
        { name: "kind", value: "cancellation-credit" },
        { name: "locale", value: "en" },
      ]),
    );

    expect(calls[1]![0].to).toBe("franciscojgonzalezfernandez@gmail.com");
    expect(calls[1]![1]?.idempotencyKey).toBe("cancel-book_1-ops_notif-ops");
    expect(calls[1]![0].tags).toEqual(
      expect.arrayContaining([
        { name: "kind", value: "cancellation-ops-notif" },
        { name: "locale", value: "en" },
      ]),
    );
  });

  test("booker subject uses booker locale (de)", async () => {
    const { deps, client } = makeDeps({
      booking: makeBooking({ language: Locale.de }),
    });
    await sendCancellationEmailsWith(deps, creditArgs);
    const calls = callsOf(client);
    expect(calls[0]![0].subject as string).toContain("Stornierung");
    expect(calls[0]![0].tags).toEqual(
      expect.arrayContaining([{ name: "locale", value: "de" }]),
    );
    // ops always EN
    expect(calls[1]![0].subject as string).toContain("Booking cancelled");
    expect(calls[1]![0].tags).toEqual(
      expect.arrayContaining([{ name: "locale", value: "en" }]),
    );
  });
});

describe("sendCancellationEmailsWith — forfeit variant", () => {
  const forfeitArgs: CancellationDispatchArgs = {
    bookingId: "book_1",
    variant: "forfeit",
    hoursBeforeStart: 12,
  };

  test("sends booker forfeit email with forfeit idempotency key", async () => {
    const { deps, client } = makeDeps();
    const result = await sendCancellationEmailsWith(deps, forfeitArgs);
    expect(result.ok).toBe(true);

    const calls = callsOf(client);
    expect(calls[0]![1]?.idempotencyKey).toBe("cancel-book_1-forfeit-booker");
    expect(calls[0]![0].tags).toEqual(
      expect.arrayContaining([
        { name: "kind", value: "cancellation-forfeit" },
      ]),
    );
    expect(calls[0]![0].text as string).toContain("12 hours");
  });

  test("ops notif carries forfeit variant outcome", async () => {
    const { deps, client } = makeDeps();
    await sendCancellationEmailsWith(deps, forfeitArgs);
    const calls = callsOf(client);
    expect(calls[1]![0].text as string).toContain("forfeited");
  });
});

describe("sendCancellationEmailsWith — idempotency + edge cases", () => {
  const creditArgs: CancellationDispatchArgs = {
    bookingId: "book_1",
    variant: "credit",
    hoursBeforeStart: 96,
    creditAmountCents: 11_000,
    creditExpiresAt: new Date("2027-12-05T00:00:00.000Z"),
  };

  test("skips booker send when cancellationEmailSentAt is set", async () => {
    const { deps, updates, client } = makeDeps({
      booking: makeBooking({
        cancellationEmailSentAt: new Date("2026-12-01T07:00:00.000Z"),
      }),
    });
    const result = await sendCancellationEmailsWith(deps, creditArgs);
    expect(result).toEqual({
      ok: true,
      booker: { sent: false, reason: "ALREADY_SENT" },
      ops: { sent: true, emailId: "email_booker_123" },
    });
    expect(client.emails.send).toHaveBeenCalledTimes(1);
    expect(updates).toEqual([
      { id: "book_1", opsCancellationNotifSentAt: FIXED_NOW },
    ]);
  });

  test("skips ops send when opsCancellationNotifSentAt is set", async () => {
    const { deps, updates, client } = makeDeps({
      booking: makeBooking({
        opsCancellationNotifSentAt: new Date("2026-12-01T07:00:00.000Z"),
      }),
    });
    const result = await sendCancellationEmailsWith(deps, creditArgs);
    expect(result).toEqual({
      ok: true,
      booker: { sent: true, emailId: "email_booker_123" },
      ops: { sent: false, reason: "ALREADY_SENT" },
    });
    expect(client.emails.send).toHaveBeenCalledTimes(1);
    expect(updates).toEqual([
      { id: "book_1", cancellationEmailSentAt: FIXED_NOW },
    ]);
  });

  test("no-op when both timestamps already set — no update written", async () => {
    const { deps, updates, client } = makeDeps({
      booking: makeBooking({
        cancellationEmailSentAt: new Date("2026-12-01T07:00:00.000Z"),
        opsCancellationNotifSentAt: new Date("2026-12-01T07:00:00.000Z"),
      }),
    });
    const result = await sendCancellationEmailsWith(deps, creditArgs);
    expect(result).toEqual({
      ok: true,
      booker: { sent: false, reason: "ALREADY_SENT" },
      ops: { sent: false, reason: "ALREADY_SENT" },
    });
    expect(client.emails.send).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  test("returns BOOKING_NOT_FOUND when no row matches", async () => {
    const { deps, client } = makeDeps({ booking: null });
    const result = await sendCancellationEmailsWith(deps, creditArgs);
    expect(result).toEqual({ ok: false, error: "BOOKING_NOT_FOUND" });
    expect(client.emails.send).not.toHaveBeenCalled();
  });
});
