import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import {
  PrismaClient,
  BookingStatus,
  Duration,
  Level,
  Locale as DbLocale,
} from "@prisma/client";

// Playwright runs with NODE_ENV=test; Next's loadEnvConfig skips .env.local.
// Load .env.local explicitly so this spec writes to the dev Neon branch.
loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const ICS_UID_PREFIX = "f-047-";

test.afterAll(async () => {
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: ICS_UID_PREFIX } },
  });
  await prisma.$disconnect();
});

type Locale = "en" | "de" | "es";
const LOCALES: Locale[] = ["en", "de", "es"];

// Section structure + listing assertions live in e2e/f-057-dashboard-sections.
// This spec keeps the orthogonal behaviours: anonymous-redirect gating and
// per-user isolation of the bookings query.

const BOOKING_DATE = "2027-05-16";
const BOOKING_TIME = "10:00";

function uniqueEmail(tag: string) {
  return `f047-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(
  page: Page,
  email: string,
  name = "F047 Tester",
): Promise<void> {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill(name);
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

async function createBookingFor(
  userId: string,
  instructorId: string,
  status: BookingStatus,
  offsetDays = 0,
): Promise<string> {
  const uid = `f-047-${userId.slice(-6)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const baseDate = new Date(`${BOOKING_DATE}T00:00:00.000Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + offsetDays);
  const booking = await prisma.booking.create({
    data: {
      bookerId: userId,
      instructorId,
      date: baseDate,
      anchorTime: BOOKING_TIME,
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status,
      totalPriceCents: 8000,
      icsUid: uid,
      attendees: {
        create: [
          {
            name: "F-047 Tester",
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

test.describe("F-047 — Dashboard anonymous redirect", () => {
  for (const locale of LOCALES) {
    test(`anonymous /${locale}/dashboard redirects to /${locale}/login with next=`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/dashboard`);
      await page.waitForURL(new RegExp(`/${locale}/login\\?next=`, "u"));
      const url = new URL(page.url());
      expect(url.pathname).toBe(`/${locale}/login`);
      expect(url.searchParams.get("next")).toBe(`/${locale}/dashboard`);
    });
  }
});

test.describe("F-047 — Dashboard per-user isolation", () => {
  test("only the signed-in user's bookings appear in the rows list", async ({
    page,
  }) => {
    const instructorId = await pickInstructorId();

    // User A owns one CONFIRMED booking.
    const aEmail = uniqueEmail("isolation-a");
    await signUp(page, aEmail);
    const aId = await findUserIdByEmail(aEmail);
    await createBookingFor(aId, instructorId, BookingStatus.CONFIRMED);

    // User B never books anything — must see zero rows on their dashboard.
    await page.context().clearCookies();
    const bEmail = uniqueEmail("isolation-b");
    await signUp(page, bEmail, "F047 Other");

    await page.goto("/en/dashboard");
    await expect(page.getByTestId("dashboard-booking-row")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-empty-upcoming")).toBeVisible();
    await expect(page.getByTestId("dashboard-account-email")).toHaveText(
      bEmail,
    );
  });
});
