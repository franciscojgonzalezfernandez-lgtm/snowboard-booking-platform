import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import {
  PrismaClient,
  BookingStatus,
  CreditStatus,
  Duration,
  Level,
  Locale as DbLocale,
} from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const ICS_UID_PREFIX = "f-058-";
// Far enough out to be unambiguously inside the ≥48h credit window.
const UPCOMING_DATE = "2027-01-15";
const BOOKING_TIME = "10:00";
const PRICE_CENTS = 11000;

test.afterAll(async () => {
  await prisma.accountCredit.deleteMany({
    where: { sourceBooking: { icsUid: { startsWith: ICS_UID_PREFIX } } },
  });
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: ICS_UID_PREFIX } },
  });
  await prisma.$disconnect();
});

function uniqueEmail(tag: string) {
  return `f058-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F058 Tester");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
  await page.getByTestId("submit-credentials").click();
  await page.waitForURL(/\/(en|de|es)\/?$/);
}

async function findUserIdByEmail(email: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`User not found after signup: ${email}`);
  return user.id;
}

async function pickInstructorId(): Promise<string> {
  const instructor = await prisma.instructor.findFirst({
    where: { active: true },
    select: { id: true },
  });
  if (!instructor) throw new Error("No active instructor seeded");
  return instructor.id;
}

async function seedConfirmedUpcoming(
  userId: string,
  instructorId: string,
): Promise<string> {
  const uid = `${ICS_UID_PREFIX}${userId.slice(-6)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const booking = await prisma.booking.create({
    data: {
      bookerId: userId,
      instructorId,
      date: new Date(`${UPCOMING_DATE}T00:00:00.000Z`),
      anchorTime: BOOKING_TIME,
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: BookingStatus.CONFIRMED,
      totalPriceCents: PRICE_CENTS,
      paidAt: new Date("2026-05-01T10:00:00.000Z"),
      icsUid: uid,
      attendees: {
        create: [
          {
            name: "F-058 Tester",
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

test.describe("F-058 — User cancel flow (credit path)", () => {
  test("cancelling a ≥48h booking moves it to Cancelled and issues a credit", async ({
    page,
  }) => {
    const email = uniqueEmail("credit");
    await signUp(page, email);
    const userId = await findUserIdByEmail(email);
    const instructorId = await pickInstructorId();
    const bookingId = await seedConfirmedUpcoming(userId, instructorId);

    await page.goto("/en/dashboard");

    // Booking starts in Upcoming.
    await expect(
      page.getByTestId("dashboard-section-count-upcoming"),
    ).toHaveText("1");
    const upcomingRow = page
      .getByTestId("dashboard-bookings-upcoming")
      .getByTestId("dashboard-booking-row");
    await expect(upcomingRow).toHaveAttribute("data-booking-id", bookingId);

    // Open the actions menu → Cancel → confirm.
    await upcomingRow.getByTestId("dashboard-booking-actions").click();
    await page.getByTestId("dashboard-booking-cancel-trigger").click();

    const dialog = page.getByTestId("cancel-dialog");
    await expect(dialog).toBeVisible();
    // Credit-branch copy mentions the credit amount.
    await expect(page.getByTestId("cancel-dialog-body")).toContainText("110.00");

    await page.getByTestId("cancel-dialog-confirm").click();

    // Success toast + row migrates to Cancelled.
    await expect(page.getByText("Booking cancelled")).toBeVisible();
    await expect(
      page.getByTestId("dashboard-section-count-upcoming"),
    ).toHaveText("0");

    const cancelledRow = page
      .getByTestId("dashboard-bookings-cancelled")
      .getByTestId("dashboard-booking-row")
      .filter({ has: page.locator(`[data-booking-id="${bookingId}"]`) })
      .or(
        page
          .getByTestId("dashboard-bookings-cancelled")
          .locator(`[data-booking-id="${bookingId}"]`),
      );
    await expect(cancelledRow.first()).toBeVisible();
    await expect(
      page.getByTestId("dashboard-booking-credit-issued"),
    ).toContainText("110.00");

    // DB reflects the cancellation + a fresh ACTIVE credit for the price.
    const row = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true, cancelledByUserAt: true },
    });
    expect(row?.status).toBe(BookingStatus.CANCELLED_BY_USER);
    expect(row?.cancelledByUserAt).not.toBeNull();

    const credit = await prisma.accountCredit.findFirst({
      where: { sourceBookingId: bookingId },
      select: { amountCents: true, status: true },
    });
    expect(credit?.amountCents).toBe(PRICE_CENTS);
    expect(credit?.status).toBe(CreditStatus.ACTIVE);
  });
});
