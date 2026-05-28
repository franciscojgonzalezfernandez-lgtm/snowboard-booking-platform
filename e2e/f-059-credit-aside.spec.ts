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

const ICS_UID_PREFIX = "f-059-";
const CANCELLED_DATE = "2027-02-10";
const BOOKING_TIME = "10:00";
// One year out — comfortably ACTIVE and outside the 30-day "expires soon" band.
const FAR_EXPIRY = new Date("2027-05-01T00:00:00.000Z");

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
  return `f059-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F059 Tester");
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

// Each credit needs a source booking (FK). One cancelled booking is enough to
// back any number of credits for the purposes of this aside test.
async function seedSourceBooking(
  userId: string,
  instructorId: string,
): Promise<string> {
  const uid = `${ICS_UID_PREFIX}${userId.slice(-6)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const booking = await prisma.booking.create({
    data: {
      bookerId: userId,
      instructorId,
      date: new Date(`${CANCELLED_DATE}T00:00:00.000Z`),
      anchorTime: BOOKING_TIME,
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: BookingStatus.CANCELLED_BY_USER,
      totalPriceCents: 11000,
      cancelledByUserAt: new Date("2026-05-01T10:00:00.000Z"),
      icsUid: uid,
      attendees: {
        create: [
          {
            name: "F-059 Tester",
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

async function seedCredits(
  userId: string,
  sourceBookingId: string,
  amounts: { amountCents: number; expiresAt: Date }[],
): Promise<void> {
  for (const { amountCents, expiresAt } of amounts) {
    await prisma.accountCredit.create({
      data: {
        userId,
        amountCents,
        sourceBookingId,
        reason: CreditReason.USER_CANCEL,
        status: CreditStatus.ACTIVE,
        expiresAt,
      },
    });
  }
}

test.describe("F-059 — Credit aside in dashboard", () => {
  test("no credits → empty microtext, no aside", async ({ page }) => {
    const email = uniqueEmail("empty");
    await signUp(page, email);

    await page.goto("/en/dashboard");
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByTestId("dashboard-credits-empty")).toBeVisible();
    await expect(page.getByTestId("dashboard-credit-aside")).toHaveCount(0);
  });

  test("one credit → aside with one row, correct total, apply link", async ({
    page,
  }) => {
    const email = uniqueEmail("one");
    await signUp(page, email);
    const userId = await findUserIdByEmail(email);
    const instructorId = await pickInstructorId();
    const sourceId = await seedSourceBooking(userId, instructorId);
    await seedCredits(userId, sourceId, [
      { amountCents: 11000, expiresAt: FAR_EXPIRY },
    ]);

    await page.goto("/en/dashboard");

    await expect(page.getByTestId("dashboard-credits-empty")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-credit-aside")).toBeVisible();
    await expect(page.getByTestId("dashboard-credit-item")).toHaveCount(1);

    const total = page.getByTestId("dashboard-credit-total");
    await expect(total).toContainText("CHF");
    await expect(total).toContainText("110.00");

    const apply = page.getByTestId("dashboard-credit-apply");
    await expect(apply).toHaveAttribute("href", /\/reservar\?credit=auto/);
  });

  test("two credits → two rows, summed total", async ({ page }) => {
    const email = uniqueEmail("two");
    await signUp(page, email);
    const userId = await findUserIdByEmail(email);
    const instructorId = await pickInstructorId();
    const sourceId = await seedSourceBooking(userId, instructorId);
    await seedCredits(userId, sourceId, [
      { amountCents: 11000, expiresAt: FAR_EXPIRY },
      {
        amountCents: 22000,
        expiresAt: new Date("2027-08-01T00:00:00.000Z"),
      },
    ]);

    await page.goto("/en/dashboard");

    await expect(page.getByTestId("dashboard-credit-aside")).toBeVisible();
    await expect(page.getByTestId("dashboard-credit-item")).toHaveCount(2);
    await expect(page.getByTestId("dashboard-credit-total")).toContainText(
      "330.00",
    );
  });
});
