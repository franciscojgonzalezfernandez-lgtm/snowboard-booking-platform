import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import {
  BookingStatus,
  Duration,
  Level,
  Locale as DbLocale,
  PrismaClient,
  Role,
} from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const ICS_UID_PREFIX = "f-081-";
const EMAIL_PREFIX = "f081-";

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, name: string): Promise<string> {
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
  return user.id;
}

/** Sign up the user the test acts as, granting admin + instructor. */
async function signUpAsAdminInstructor(page: Page): Promise<{
  userId: string;
  instructorId: string;
}> {
  const userId = await signUp(page, "F081 Admin");
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.instructor, Role.admin] },
  });
  const instructor = await prisma.instructor.create({
    data: {
      userId,
      bio: "F081 admin-instructor",
      specialties: [],
      languages: [DbLocale.en],
    },
    select: { id: true },
  });
  return { userId, instructorId: instructor.id };
}

/** Today at UTC midnight — `Booking.date` is `@db.Date`. */
function todayUtcMidnight(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** Seed an auto-completed booking (the F-062 sweep outcome): COMPLETED + a
 *  non-null `autoCompletedAt`, dated today so it also lands in the agenda. */
async function seedAutoCompleted({
  instructorId,
  bookerId,
  anchorTime = "08:00",
}: {
  instructorId: string;
  bookerId: string;
  anchorTime?: string;
}): Promise<string> {
  const tag = Math.random().toString(36).slice(2, 8);
  const booking = await prisma.booking.create({
    data: {
      instructorId,
      bookerId,
      date: todayUtcMidnight(),
      anchorTime,
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: BookingStatus.COMPLETED,
      totalPriceCents: 11000,
      chargeAmountCents: 11000,
      paidAt: new Date(),
      autoCompletedAt: new Date(),
      icsUid: `${ICS_UID_PREFIX}${tag}@example.test`,
      attendees: {
        create: {
          name: "F081 Pupil",
          birthDate: new Date("2000-01-01"),
          level: Level.BEGINNER,
        },
      },
    },
    select: { id: true },
  });
  return booking.id;
}

test.afterAll(async () => {
  await prisma.attendee.deleteMany({
    where: { booking: { icsUid: { startsWith: ICS_UID_PREFIX } } },
  });
  await prisma.accountCredit.deleteMany({
    where: { user: { email: { startsWith: EMAIL_PREFIX } } },
  });
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: ICS_UID_PREFIX } },
  });
  await prisma.instructor.deleteMany({
    where: { user: { email: { startsWith: EMAIL_PREFIX } } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
  });
  await prisma.$disconnect();
});

test("admin re-flips an auto-completed booking to no-show — status flips, no credit", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { userId, instructorId } = await signUpAsAdminInstructor(page);
  const bookingId = await seedAutoCompleted({ instructorId, bookerId: userId });

  await page.goto(`/admin/bookings/${bookingId}`);
  await expect(page.getByTestId("admin-booking-detail-status")).toHaveText(
    "Completed",
  );
  await page.getByTestId("no-show-button").click();
  await expect(page.getByTestId("no-show-dialog")).toBeVisible();
  await page.getByTestId("no-show-dialog-confirm").click();

  // After the flip the action is gone (no longer COMPLETED).
  await expect(page.getByTestId("no-show-button")).toHaveCount(0);

  const after = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, cancelledByUserAt: true },
  });
  expect(after?.status).toBe(BookingStatus.CANCELLED_BY_USER);
  // cancelledByUserAt == class start (date + anchorTime), not "now".
  expect(after?.cancelledByUserAt?.toISOString()).toBe(
    `${todayUtcMidnight().toISOString().slice(0, 10)}T08:00:00.000Z`,
  );

  // Forfeit: no credit was minted for this booking.
  const credits = await prisma.accountCredit.count({
    where: { sourceBookingId: bookingId },
  });
  expect(credits).toBe(0);
});

test("instructor re-flips an auto-completed booking from the agenda", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { userId, instructorId } = await signUpAsAdminInstructor(page);
  const bookingId = await seedAutoCompleted({
    instructorId,
    bookerId: userId,
    anchorTime: "09:00",
  });

  await page.goto("/instructor");
  const row = page.locator(
    `[data-testid="agenda-booking-row"][data-booking-id="${bookingId}"]`,
  );
  await expect(row).toBeVisible();
  await row.getByTestId("no-show-button").click();
  await expect(page.getByTestId("no-show-dialog")).toBeVisible();
  await page.getByTestId("no-show-dialog-confirm").click();

  // Row leaves the default agenda once it is CANCELLED_BY_USER.
  await expect(page.locator(`[data-booking-id="${bookingId}"]`)).toHaveCount(0);

  const after = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, cancelledByUserAt: true },
  });
  expect(after?.status).toBe(BookingStatus.CANCELLED_BY_USER);
  expect(after?.cancelledByUserAt?.toISOString()).toBe(
    `${todayUtcMidnight().toISOString().slice(0, 10)}T09:00:00.000Z`,
  );
  const credits = await prisma.accountCredit.count({
    where: { sourceBookingId: bookingId },
  });
  expect(credits).toBe(0);
});
