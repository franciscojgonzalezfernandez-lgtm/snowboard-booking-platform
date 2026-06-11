import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import {
  BookingStatus,
  CreditReason,
  CreditStatus,
  Duration,
  Level,
  Locale as DbLocale,
  PrismaClient,
  Role,
} from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const EMAIL_PREFIX = "f079-";

// Drives the F-079 batch through the credit-paid path so we don't need live
// Stripe — same trick as F-078. Two CONFIRMED credit-paid bookings on the
// same future day, both for the same admin/instructor, get cancelled in one
// click. Cash-refund batching is covered by the Vitest core where stripeRefund
// is injected.

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(
  page: Page,
  name: string,
): Promise<{ userId: string; email: string }> {
  const email = uniqueEmail("u");
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill(name);
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
  await page.getByTestId("submit-credentials").click();
  await page.waitForURL(/\/(en|de|es)\/?$/);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`User not found after signup: ${email}`);
  return { userId: user.id, email };
}

async function signUpAsAdmin(
  page: Page,
): Promise<{ userId: string; email: string; instructorId: string }> {
  const { userId, email } = await signUp(page, "F079 Admin");
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.instructor, Role.admin] },
  });
  const instructor = await prisma.instructor.create({
    data: {
      userId,
      bio: "F079 admin-instructor",
      specialties: [],
      languages: [DbLocale.en],
    },
    select: { id: true },
  });
  return { userId, email, instructorId: instructor.id };
}

type SeedOpts = {
  instructorId: string;
  bookerId: string;
  date: Date;
  anchorTime: string;
};

async function seedCreditPaidBooking(opts: SeedOpts): Promise<string> {
  const tag = Math.random().toString(36).slice(2, 8);
  const booking = await prisma.booking.create({
    data: {
      instructorId: opts.instructorId,
      bookerId: opts.bookerId,
      date: opts.date,
      anchorTime: opts.anchorTime,
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: BookingStatus.CONFIRMED,
      totalPriceCents: 11000,
      chargeAmountCents: 0,
      creditsAppliedCents: 11000,
      paidAt: null,
      icsUid: `f079-${tag}@example.test`,
      attendees: {
        create: [
          {
            name: "Self",
            birthDate: new Date("1990-01-01T00:00:00.000Z"),
            level: Level.INTERMEDIATE,
            isBooker: true,
          },
        ],
      },
    },
    select: { id: true },
  });
  return booking.id;
}

test.afterAll(async () => {
  await prisma.accountCredit.deleteMany({
    where: { sourceBooking: { icsUid: { startsWith: "f079-" } } },
  });
  await prisma.attendee.deleteMany({
    where: { booking: { icsUid: { startsWith: "f079-" } } },
  });
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: "f079-" } },
  });
  await prisma.instructor.deleteMany({
    where: { user: { email: { startsWith: EMAIL_PREFIX } } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
  });
  await prisma.$disconnect();
});

test("batch-cancels every active booking on a day → both flip to CANCELLED_BY_OPS, credits re-emitted", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { userId: adminId, instructorId } = await signUpAsAdmin(page);

  // Pick a date ~30 days out so daylight-savings / weekend layout in the
  // calendar widget can't break the date input fill.
  const now = new Date();
  const dayDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30),
  );
  const dayIso = dayDate.toISOString().slice(0, 10);

  const bookingA = await seedCreditPaidBooking({
    instructorId,
    bookerId: adminId,
    date: dayDate,
    anchorTime: "09:00",
  });
  const bookingB = await seedCreditPaidBooking({
    instructorId,
    bookerId: adminId,
    date: dayDate,
    anchorTime: "11:00",
  });

  await page.goto(`/admin/cancel-day?date=${dayIso}`);

  await expect(page.getByTestId("cancel-day-preview")).toBeVisible();
  await expect(page.getByTestId("cancel-day-total-bookings")).toHaveText("2");
  await expect(page.getByTestId(`cancel-day-booking-${bookingA}`)).toBeVisible();
  await expect(page.getByTestId(`cancel-day-booking-${bookingB}`)).toBeVisible();

  await page.getByTestId("cancel-day-open-confirm").click();
  await expect(page.getByTestId("cancel-day-dialog")).toBeVisible();
  await page.getByTestId("cancel-day-reason").fill("avalanche risk");
  await page.getByTestId("cancel-day-dialog-confirm").click();

  // Server action returns; the page refreshes and now shows the empty state
  // because nothing CONFIRMED is left on that day.
  await expect(page.getByTestId("cancel-day-total-bookings")).toHaveText("0", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("cancel-day-empty")).toBeVisible();

  const after = await prisma.booking.findMany({
    where: { id: { in: [bookingA, bookingB] } },
    select: { id: true, status: true, opsReason: true },
  });
  expect(after).toHaveLength(2);
  for (const row of after) {
    expect(row.status).toBe(BookingStatus.CANCELLED_BY_OPS);
    expect(row.opsReason).toBe("avalanche risk");
  }

  const credits = await prisma.accountCredit.findMany({
    where: {
      sourceBookingId: { in: [bookingA, bookingB] },
      reason: CreditReason.OPS_CANCEL,
    },
    select: { amountCents: true, status: true, sourceBookingId: true },
  });
  expect(credits).toHaveLength(2);
  for (const credit of credits) {
    expect(credit.amountCents).toBe(11000);
    expect(credit.status).toBe(CreditStatus.ACTIVE);
  }
});
