import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import {
  PrismaClient,
  BookingStatus,
  CreditReason,
  CreditStatus,
  Duration,
  Level,
  Locale as DbLocale,
} from "@prisma/client";

import { durationMinutes } from "@/lib/booking-engine/duration";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const ICS_UID_PREFIX = "f-060-";
const FAR_EXPIRY = new Date("2027-12-01T00:00:00.000Z");
// ONE_HOUR lesson price from prisma/seed.ts (CHF 110.00).
const ONE_HOUR_PRICE_CENTS = 11000;

// Availability is seeded for 8 weeks from 2026-11-15. Search inside that window
// for slots the seed booking plan hasn't already taken.
const WINDOW_START = new Date("2026-11-16T00:00:00.000Z");
const WINDOW_END = new Date("2027-01-08T00:00:00.000Z");
const ANCHORS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
];

type Slot = { date: string; time: string };

const createdUserIds: string[] = [];
let instructorId: string;
let zeroChargeSlot: Slot;
let partialSlot: Slot;

function toMinutes(hhmm: string): number {
  const parts = hhmm.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

/**
 * Find `count` free ONE_HOUR slots (one per day, so the spec's own bookings
 * never collide with each other) for the given instructor, skipping any anchor
 * that overlaps an existing PENDING/CONFIRMED/COMPLETED booking.
 */
async function findFreeSlots(forInstructorId: string, count: number): Promise<Slot[]> {
  const bookings = await prisma.booking.findMany({
    where: {
      instructorId: forInstructorId,
      status: {
        in: [
          BookingStatus.PENDING_PAYMENT,
          BookingStatus.CONFIRMED,
          BookingStatus.COMPLETED,
        ],
      },
    },
    select: { date: true, anchorTime: true, duration: true },
  });

  const occupiedByDate = new Map<string, Array<[number, number]>>();
  for (const b of bookings) {
    const key = b.date.toISOString().slice(0, 10);
    const start = toMinutes(b.anchorTime);
    const arr = occupiedByDate.get(key) ?? [];
    arr.push([start, start + durationMinutes(b.duration)]);
    occupiedByDate.set(key, arr);
  }

  const slots: Slot[] = [];
  for (
    const day = new Date(WINDOW_START);
    day <= WINDOW_END && slots.length < count;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const iso = day.toISOString().slice(0, 10);
    const occupied = occupiedByDate.get(iso) ?? [];
    for (const anchor of ANCHORS) {
      const start = toMinutes(anchor);
      const end = start + 60;
      const conflict = occupied.some(([bs, be]) => start < be && bs < end);
      if (!conflict) {
        slots.push({ date: iso, time: anchor });
        break; // one slot per day
      }
    }
  }

  if (slots.length < count) {
    throw new Error(`Only found ${slots.length}/${count} free slots in window`);
  }
  return slots;
}

test.beforeAll(async () => {
  const instructor = await prisma.instructor.findFirst({
    where: { active: true, languages: { has: DbLocale.en } },
    select: { id: true },
  });
  if (!instructor) throw new Error("No active en-speaking instructor seeded");
  instructorId = instructor.id;

  const slots = await findFreeSlots(instructorId, 2);
  zeroChargeSlot = slots[0]!;
  partialSlot = slots[1]!;
});

test.afterAll(async () => {
  // Order matters: credits reference bookings (source + redemption), and
  // attendees restrict their booking, so clear them before the bookings. This
  // also frees the slots the funnel booked so re-runs stay green.
  if (createdUserIds.length > 0) {
    await prisma.accountCredit.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.attendee.deleteMany({
      where: { booking: { bookerId: { in: createdUserIds } } },
    });
    await prisma.booking.deleteMany({
      where: { bookerId: { in: createdUserIds } },
    });
  }
  await prisma.$disconnect();
});

function uniqueEmail(tag: string): string {
  return `f060-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, email: string): Promise<string> {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F060 Tester");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
  await page.getByTestId("submit-credentials").click();
  await page.waitForURL(/\/(en|de|es)\/?$/);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`User not found after signup: ${email}`);
  createdUserIds.push(user.id);
  return user.id;
}

// A credit needs a source booking (FK). One cancelled booking backs the credit.
async function seedCredit(userId: string, amountCents: number): Promise<void> {
  const uid = `${ICS_UID_PREFIX}${userId.slice(-6)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const source = await prisma.booking.create({
    data: {
      bookerId: userId,
      instructorId,
      date: new Date("2027-02-01T00:00:00.000Z"),
      anchorTime: "10:00",
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: BookingStatus.CANCELLED_BY_USER,
      totalPriceCents: amountCents,
      cancelledByUserAt: new Date("2026-05-01T10:00:00.000Z"),
      icsUid: uid,
      attendees: {
        create: [
          {
            name: "F-060 Tester",
            birthDate: new Date("1990-01-01T00:00:00.000Z"),
            level: Level.INTERMEDIATE,
            isBooker: true,
          },
        ],
      },
    },
    select: { id: true },
  });
  await prisma.accountCredit.create({
    data: {
      userId,
      amountCents,
      sourceBookingId: source.id,
      reason: CreditReason.USER_CANCEL,
      status: CreditStatus.ACTIVE,
      expiresAt: FAR_EXPIRY,
    },
  });
}

function bookingUrl(slot: Slot): string {
  const url = new URL("http://localhost/en/reservar");
  url.searchParams.set("d", "ONE_HOUR");
  url.searchParams.set("dt", slot.date);
  url.searchParams.set("t", slot.time);
  url.searchParams.set("i", instructorId);
  url.searchParams.set("l", "en");
  url.searchParams.set("credit", "auto");
  return url.pathname + url.search;
}

// Fill the Step 4 booker + attendee + terms so the submit button enables.
async function fillStep4Form(page: Page): Promise<void> {
  await expect(page.getByTestId("step4-form")).toBeVisible();
  await page.getByTestId("booker-name").fill("F060 Tester");
  await page.getByTestId("booker-phone").fill("+41 76 638 1870");
  await page.getByTestId("attendee-0-name").fill("Lara");
  await page.getByTestId("attendee-0-age").fill("28");
  await page.getByTestId("terms-checkbox").click();
  // Submit enables only once RHF marks the form valid.
  await expect(page.getByTestId("step4-submit")).toBeEnabled();
}

test.describe("F-060 — checkout credit redemption", () => {
  test("credits fully cover the lesson → zero-charge booking confirmed without a card", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const userId = await signUp(page, uniqueEmail("full"));
    await seedCredit(userId, ONE_HOUR_PRICE_CENTS);

    await page.goto(bookingUrl(zeroChargeSlot), {
      waitUntil: "domcontentloaded",
    });

    // ?credit=auto expands the section and pre-selects the applicable credit.
    await expect(page.getByTestId("step4-credits")).toBeVisible();
    await expect(page.getByTestId("step4-credits-total")).toContainText(
      "110.00",
    );

    await fillStep4Form(page);

    // Fully covered → the CTA becomes "Confirm booking" (no payment step).
    const submit = page.getByTestId("step4-submit");
    await expect(submit).toHaveText(/Confirm booking/i);
    await expect(submit).toBeEnabled();
    await submit.click();

    // Zero-charge path redirects straight to the success page, CONFIRMED.
    await page.waitForURL(/\/en\/reservar\/exito\//);
    const exito = page.getByTestId("exito-page");
    await expect(exito).toBeVisible();
    await expect(exito).toHaveAttribute("data-status", "CONFIRMED");

    // No Stripe Payment Element ever rendered.
    await expect(page.getByTestId("payment-element")).toHaveCount(0);

    // Ledger: the credit settled to USED on the new booking.
    const credits = await prisma.accountCredit.findMany({
      where: { userId },
      select: { status: true },
    });
    expect(credits).toHaveLength(1);
    expect(credits[0]!.status).toBe(CreditStatus.USED);
  });

  test("a partial credit discounts the charge → Step 5 shows the breakdown + Payment Element", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const userId = await signUp(page, uniqueEmail("partial"));
    await seedCredit(userId, 5000);

    await page.goto(bookingUrl(partialSlot), {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("step4-credits")).toBeVisible();
    await expect(page.getByTestId("step4-credits-total")).toContainText("50.00");

    await fillStep4Form(page);

    // Not fully covered → CTA still routes to payment.
    const submit = page.getByTestId("step4-submit");
    await expect(submit).toHaveText(/Continue to payment/i);
    await submit.click();

    // Step 5 reveals the lesson price − credits = charge breakdown.
    await expect(page.getByTestId("section-5")).toBeVisible();
    await expect(page.getByTestId("step5-summary-total")).toContainText(
      "110.00",
    );
    await expect(page.getByTestId("step5-summary-credits")).toContainText(
      "50.00",
    );
    await expect(page.getByTestId("step5-summary-charge")).toContainText(
      "60.00",
    );
    // A card is still required for the remaining CHF 60.
    await expect(page.getByTestId("step5-pay")).toContainText("60.00");
  });
});
