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

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const ICS_UID_PREFIX = "f-069-";

const FUTURE_UPCOMING_DATE = "2027-01-15";
const FUTURE_CANCELLED_DATE = "2027-02-20";
const PAST_COMPLETED_DATE = "2026-04-15";
const BOOKING_TIME = "10:00";

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
  return `f069-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F069 Tester");
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

type SeedBooking = {
  status: BookingStatus;
  date: string;
  tag: string;
  cancelledByUserAt?: Date;
  withCredit?: boolean;
};

async function seedBooking(
  userId: string,
  instructorId: string,
  spec: SeedBooking,
): Promise<{ bookingId: string }> {
  const uid = `${ICS_UID_PREFIX}${spec.tag}-${userId.slice(-6)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const booking = await prisma.booking.create({
    data: {
      bookerId: userId,
      instructorId,
      date: new Date(`${spec.date}T00:00:00.000Z`),
      anchorTime: BOOKING_TIME,
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: spec.status,
      totalPriceCents: 11000,
      icsUid: uid,
      cancelledByUserAt: spec.cancelledByUserAt ?? null,
      attendees: {
        create: [
          {
            name: "F-069 Tester",
            birthDate: new Date("1990-01-01T00:00:00.000Z"),
            level: Level.INTERMEDIATE,
            isBooker: true,
          },
        ],
      },
    },
    select: { id: true },
  });

  if (spec.withCredit) {
    await prisma.accountCredit.create({
      data: {
        userId,
        amountCents: 11000,
        sourceBookingId: booking.id,
        reason: CreditReason.USER_CANCEL,
        status: CreditStatus.ACTIVE,
        expiresAt: new Date("2027-12-31T00:00:00.000Z"),
      },
    });
  }

  return { bookingId: booking.id };
}

async function seedPortfolio(page: Page) {
  const email = uniqueEmail("tabs");
  await signUp(page, email);
  const userId = await findUserIdByEmail(email);
  const instructorId = await pickInstructorId();

  const upcoming = await seedBooking(userId, instructorId, {
    status: BookingStatus.CONFIRMED,
    date: FUTURE_UPCOMING_DATE,
    tag: "up",
  });
  const past = await seedBooking(userId, instructorId, {
    status: BookingStatus.COMPLETED,
    date: PAST_COMPLETED_DATE,
    tag: "past",
  });
  await seedBooking(userId, instructorId, {
    status: BookingStatus.CANCELLED_BY_USER,
    date: FUTURE_CANCELLED_DATE,
    tag: "cx1",
    cancelledByUserAt: new Date("2026-05-20T10:00:00.000Z"),
    withCredit: true,
  });
  await seedBooking(userId, instructorId, {
    status: BookingStatus.CANCELLED_BY_USER,
    date: FUTURE_CANCELLED_DATE,
    tag: "cx2",
    cancelledByUserAt: new Date("2026-05-21T10:00:00.000Z"),
    withCredit: true,
  });

  return { upcomingId: upcoming.bookingId, pastId: past.bookingId };
}

test.describe("F-069 — Dashboard tabs", () => {
  test("default tab is Upcoming and counter chips reflect each section", async ({
    page,
  }) => {
    await seedPortfolio(page);
    await page.goto("/en/dashboard");

    // Upcoming is the default landing tab (it has rows).
    await expect(
      page.getByTestId("dashboard-tab-panel-upcoming"),
    ).toBeVisible();
    await expect(page.getByTestId("dashboard-tab-panel-past")).toBeHidden();
    await expect(
      page.getByTestId("dashboard-tab-panel-cancelled"),
    ).toBeHidden();

    // Counter chips: upcoming 1, past 1, cancelled 2.
    await expect(page.getByTestId("dashboard-tab-count-upcoming")).toHaveText(
      "1",
    );
    await expect(page.getByTestId("dashboard-tab-count-past")).toHaveText("1");
    await expect(page.getByTestId("dashboard-tab-count-cancelled")).toHaveText(
      "2",
    );

    // No pending bookings → no pending tab.
    await expect(page.getByTestId("dashboard-tab-pending")).toHaveCount(0);
  });

  test("selecting Cancelled hides the other panels and updates the URL", async ({
    page,
  }) => {
    await seedPortfolio(page);
    await page.goto("/en/dashboard");

    await page.getByTestId("dashboard-tab-cancelled").click();

    await expect(
      page.getByTestId("dashboard-tab-panel-cancelled"),
    ).toBeVisible();
    await expect(
      page.getByTestId("dashboard-tab-panel-upcoming"),
    ).toBeHidden();
    await expect(page.getByTestId("dashboard-tab-panel-past")).toBeHidden();

    await expect(page).toHaveURL(/[?&]tab=cancelled\b/);

    // Two cancelled rows live in the cancelled section.
    await expect(
      page
        .getByTestId("dashboard-bookings-cancelled")
        .getByTestId("dashboard-booking-row"),
    ).toHaveCount(2);
  });

  test("deep link ?tab=cancelled lands directly and survives reload", async ({
    page,
  }) => {
    await seedPortfolio(page);

    await page.goto("/en/dashboard?tab=cancelled");
    await expect(
      page.getByTestId("dashboard-tab-panel-cancelled"),
    ).toBeVisible();
    await expect(
      page.getByTestId("dashboard-tab-panel-upcoming"),
    ).toBeHidden();

    await page.reload();
    await expect(
      page.getByTestId("dashboard-tab-panel-cancelled"),
    ).toBeVisible();
  });

  test("row-action cleanup: cancelled rows drop View details, past rows drop Add to calendar", async ({
    page,
  }) => {
    await seedPortfolio(page);
    await page.goto("/en/dashboard");

    // Cancelled rows no longer link to the success page.
    await expect(
      page
        .getByTestId("dashboard-bookings-cancelled")
        .getByTestId("dashboard-booking-link"),
    ).toHaveCount(0);

    // Past rows no longer expose the ICS / Add-to-calendar link.
    await expect(
      page
        .getByTestId("dashboard-bookings-past")
        .getByTestId("dashboard-booking-ics"),
    ).toHaveCount(0);

    // Upcoming still keeps View details.
    await expect(
      page
        .getByTestId("dashboard-bookings-upcoming")
        .getByTestId("dashboard-booking-link"),
    ).toHaveCount(1);
  });
});
