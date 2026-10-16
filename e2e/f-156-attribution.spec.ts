import { test, expect, type Page } from "@playwright/test";
import { signUpVerified } from "./helpers/auth";
import { config as loadDotenv } from "dotenv";
import {
  BookingSource,
  BookingStatus,
  CreditReason,
  CreditStatus,
  Duration,
  Level,
  Locale as DbLocale,
  PrismaClient,
  Role,
} from "@prisma/client";

import { durationMinutes } from "@/lib/booking-engine/duration";
import { ATTRIBUTION_COOKIE } from "@/lib/attribution/cookie";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const ICS_UID_PREFIX = "f-156-";
const FAR_EXPIRY = new Date("2027-12-01T00:00:00.000Z");
const ONE_HOUR_PRICE_CENTS = 11000; // CHF 110.00 from prisma/seed.ts

// Season is open Tue–Sat minus the winter break (same as F-060).
const WINDOW_START = new Date("2026-11-17T00:00:00.000Z");
const WINDOW_END = new Date("2027-01-08T00:00:00.000Z");
const ANCHORS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

type Slot = { date: string; time: string };

const createdUserIds: string[] = [];
let instructorId: string;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

async function findFreeSlot(forInstructorId: string): Promise<Slot> {
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
  const occupied = new Map<string, Array<[number, number]>>();
  for (const b of bookings) {
    const key = b.date.toISOString().slice(0, 10);
    const start = toMinutes(b.anchorTime);
    const arr = occupied.get(key) ?? [];
    arr.push([start, start + durationMinutes(b.duration)]);
    occupied.set(key, arr);
  }
  for (
    const day = new Date(WINDOW_START);
    day <= WINDOW_END;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const iso = day.toISOString().slice(0, 10);
    const wd = day.getUTCDay();
    if (wd === 0 || wd === 1) continue; // closed Sun + Mon
    if (iso >= "2026-12-28" && iso <= "2027-01-08") continue; // holiday break
    const taken = occupied.get(iso) ?? [];
    for (const anchor of ANCHORS) {
      const start = toMinutes(anchor);
      const end = start + 60;
      if (!taken.some(([bs, be]) => start < be && bs < end)) {
        return { date: iso, time: anchor };
      }
    }
  }
  throw new Error("No free slot found in the season window");
}

function uniqueEmail(tag: string): string {
  return `f156-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, tag: string, name = "F156 Tester"): Promise<string> {
  const email = uniqueEmail(tag);
  await signUpVerified(page, email, name);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`User not found after signup: ${email}`);
  createdUserIds.push(user.id);
  return user.id;
}

async function seedFullCredit(userId: string): Promise<void> {
  const uid = `${ICS_UID_PREFIX}${userId.slice(-6)}-${Date.now()}`;
  const source = await prisma.booking.create({
    data: {
      bookerId: userId,
      instructorId,
      date: new Date("2027-02-01T00:00:00.000Z"),
      anchorTime: "10:00",
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: BookingStatus.CANCELLED_BY_USER,
      totalPriceCents: ONE_HOUR_PRICE_CENTS,
      cancelledByUserAt: new Date("2026-05-01T10:00:00.000Z"),
      icsUid: uid,
      attendees: {
        create: [
          {
            name: "F156 Tester",
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
      amountCents: ONE_HOUR_PRICE_CENTS,
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

async function fillStep4AndConfirm(page: Page): Promise<void> {
  await expect(page.getByTestId("step4-form")).toBeVisible();
  await page.getByTestId("booker-name").fill("F156 Tester");
  await page.getByTestId("booker-phone").fill("+41 76 638 1870");
  await page.getByTestId("attendee-0-name").fill("Lara");
  await page.getByTestId("attendee-0-age").fill("28");
  await page.getByTestId("terms-checkbox").click();
  const submit = page.getByTestId("step4-submit");
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveText(/Confirm booking/i);
  await submit.click();
  await page.waitForURL(/\/en\/reservar\/exito\//);
}

test.beforeAll(async () => {
  const instructor = await prisma.instructor.findFirst({
    where: { active: true, languages: { has: DbLocale.en } },
    select: { id: true },
  });
  if (!instructor) throw new Error("No active en-speaking instructor seeded");
  instructorId = instructor.id;
});

test.afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.accountCredit.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.attendee.deleteMany({
      where: { booking: { bookerId: { in: createdUserIds } } },
    });
    await prisma.booking.deleteMany({ where: { bookerId: { in: createdUserIds } } });
    // Drop any instructor rows created for the admin case (and their user).
    await prisma.instructor.deleteMany({ where: { userId: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

test.describe("F-156 — booking source attribution", () => {
  test("a QR landing sets the first-touch cookie and the booking records the campaign", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    const userId = await signUp(page, "flyer");
    await seedFullCredit(userId);

    // QR landing: middleware captures `?c=` into the first-touch cookie.
    await page.goto("/en/?c=flyer-talstation", { waitUntil: "domcontentloaded" });
    const afterLanding = await context.cookies();
    expect(afterLanding.some((c) => c.name === ATTRIBUTION_COOKIE)).toBe(true);

    // Book via the zero-charge credit path (no card needed).
    const slot = await findFreeSlot(instructorId);
    await page.goto(bookingUrl(slot), { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("step4-credits")).toBeVisible();
    await fillStep4AndConfirm(page);

    // The booking snapshotted the attribution.
    const booking = await prisma.booking.findFirst({
      where: { bookerId: userId, status: BookingStatus.CONFIRMED },
      orderBy: { createdAt: "desc" },
      select: { attributionChannel: true, attributionCampaign: true },
    });
    expect(booking).toMatchObject({
      attributionChannel: BookingSource.FLYER,
      attributionCampaign: "flyer-talstation",
    });

    // First-touch cookie is cleared after a successful booking.
    const afterBooking = await context.cookies();
    expect(afterBooking.some((c) => c.name === ATTRIBUTION_COOKIE)).toBe(false);
  });

  test("untagged traffic books as DIRECT", async ({ page }) => {
    test.setTimeout(60_000);
    const userId = await signUp(page, "direct");
    await seedFullCredit(userId);

    const slot = await findFreeSlot(instructorId);
    await page.goto(bookingUrl(slot), { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("step4-credits")).toBeVisible();
    await fillStep4AndConfirm(page);

    const booking = await prisma.booking.findFirst({
      where: { bookerId: userId, status: BookingStatus.CONFIRMED },
      orderBy: { createdAt: "desc" },
      select: { attributionChannel: true, attributionCampaign: true },
    });
    expect(booking).toMatchObject({
      attributionChannel: BookingSource.DIRECT,
      attributionCampaign: null,
    });
  });

  test("admin can filter by source, see it on the detail, and in the campaign rollup", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // Admin = its own user; seed two attributed bookings under it.
    const adminId = await signUp(page, "admin", "F156 Admin");
    await prisma.user.update({
      where: { id: adminId },
      data: { roles: [Role.student, Role.instructor, Role.admin] },
    });
    const adminInstructor = await prisma.instructor.create({
      data: {
        userId: adminId,
        bio: "F156 admin-instructor",
        specialties: [],
        languages: [DbLocale.en],
      },
      select: { id: true },
    });

    const flyerBooking = await prisma.booking.create({
      data: {
        bookerId: adminId,
        instructorId: adminInstructor.id,
        date: new Date("2027-02-03T00:00:00.000Z"),
        anchorTime: "10:00",
        duration: Duration.ONE_HOUR,
        language: DbLocale.en,
        status: BookingStatus.CONFIRMED,
        totalPriceCents: ONE_HOUR_PRICE_CENTS,
        chargeAmountCents: ONE_HOUR_PRICE_CENTS,
        paidAt: new Date(),
        icsUid: `${ICS_UID_PREFIX}flyer-${Date.now()}`,
        attributionChannel: BookingSource.FLYER,
        attributionCampaign: "flyer-talstation",
        attendees: {
          create: [
            {
              name: "Flyer Booker",
              birthDate: new Date("1990-01-01T00:00:00.000Z"),
              level: Level.BEGINNER,
              isBooker: true,
            },
          ],
        },
      },
      select: { id: true },
    });
    await prisma.booking.create({
      data: {
        bookerId: adminId,
        instructorId: adminInstructor.id,
        date: new Date("2027-02-04T00:00:00.000Z"),
        anchorTime: "11:00",
        duration: Duration.ONE_HOUR,
        language: DbLocale.en,
        status: BookingStatus.CONFIRMED,
        totalPriceCents: ONE_HOUR_PRICE_CENTS,
        chargeAmountCents: ONE_HOUR_PRICE_CENTS,
        paidAt: new Date(),
        icsUid: `${ICS_UID_PREFIX}direct-${Date.now()}`,
        attributionChannel: BookingSource.DIRECT,
        attendees: {
          create: [
            {
              name: "Direct Booker",
              birthDate: new Date("1990-01-01T00:00:00.000Z"),
              level: Level.BEGINNER,
              isBooker: true,
            },
          ],
        },
      },
      select: { id: true },
    });

    // List filtered by source=FLYER shows the flyer booking's source cell.
    await page.goto("/admin/bookings?source=FLYER", { waitUntil: "domcontentloaded" });
    const flyerRow = page.locator(
      `[data-testid="admin-booking-row"][data-booking-id="${flyerBooking.id}"]`,
    );
    await expect(flyerRow).toBeVisible();
    await expect(flyerRow.getByTestId("admin-booking-source")).toHaveAttribute(
      "data-source",
      "FLYER",
    );

    // Detail shows the attribution block.
    await page.goto(`/admin/bookings/${flyerBooking.id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId("admin-detail-source")).toContainText("Flyer");
    await expect(page.getByTestId("admin-detail-campaign")).toContainText(
      "Flyer · Talstation",
    );

    // Campaign rollup lists the flyer campaign with a CHF revenue.
    await page.goto("/admin/campaigns", { waitUntil: "domcontentloaded" });
    const campaignsList = page.getByTestId("admin-campaigns-list");
    await expect(campaignsList).toContainText("Flyer · Talstation");
    await expect(campaignsList).toContainText("CHF");
  });
});
