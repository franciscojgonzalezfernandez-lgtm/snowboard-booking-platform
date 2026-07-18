import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import {
  PrismaClient,
  BookingStatus,
  Duration,
  Level,
  Locale as DbLocale,
} from "@prisma/client";

// F-107 — two render gates for CTAs that don't apply in the current context:
//   (1) the home hero "sign in" CTA must vanish for authenticated visitors;
//   (2) the exito page "add to calendar" must vanish for lessons already past.
// Same DB+auth harness as f-046 (Playwright runs with NODE_ENV=test → Next skips
// .env.local, so load it explicitly to hit the dev Neon branch).
loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();
const ICS_UID_PREFIX = "f-107-";

const FUTURE_DATE = "2027-05-15"; // outside the seeded season → no availability clash
const PAST_DATE = "2025-01-15"; // before "now" (2026+) → the lesson already happened
const BOOKING_TIME = "11:00";

const LOCALES = ["en", "de", "es"] as const;

test.afterAll(async () => {
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: ICS_UID_PREFIX } },
  });
  await prisma.$disconnect();
});

function uniqueEmail(tag: string) {
  return `f107-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F-107 Tester");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
  await page.getByTestId("submit-credentials").click();
  await page.waitForURL(/\/(en|de|es)\/?$/);
}

async function userIdByEmail(email: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`User not found after signup: ${email}`);
  return user.id;
}

async function activeInstructorId(): Promise<string> {
  const instructor = await prisma.instructor.findFirst({
    where: { active: true },
    select: { id: true },
  });
  if (!instructor) throw new Error("No active instructor seeded");
  return instructor.id;
}

async function createBooking(
  userId: string,
  instructorId: string,
  status: BookingStatus,
  date: string,
): Promise<string> {
  const uid = `${ICS_UID_PREFIX}${userId.slice(-6)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const booking = await prisma.booking.create({
    data: {
      bookerId: userId,
      instructorId,
      date: new Date(`${date}T00:00:00.000Z`),
      anchorTime: BOOKING_TIME,
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status,
      totalPriceCents: 8000,
      icsUid: uid,
      attendees: {
        create: [
          {
            name: "F-107 Tester",
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

test.describe("F-107 issue 1 — home hero sign-in CTA is session-aware", () => {
  for (const locale of LOCALES) {
    test(`anonymous /${locale} shows both hero CTAs`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.getByTestId("hero-cta-primary")).toBeVisible();
      await expect(page.getByTestId("hero-cta-signin")).toBeVisible();
    });
  }

  test("authenticated / hides the sign-in CTA, keeps the primary", async ({
    page,
  }) => {
    await signUp(page, uniqueEmail("auth"));
    await page.goto("/en");
    await expect(page.getByTestId("hero-cta-primary")).toBeVisible();
    await expect(page.getByTestId("hero-cta-signin")).toHaveCount(0);
  });
});

// One sign-up, three bookings under the same booker. Better Auth enforces
// sign-up rate limiting in production builds (`next start`), so the spec keeps
// its total sign-ups low (this test + the issue-1 auth test) rather than one
// per case.
test.describe("F-107 issue 2 — exito add-to-calendar is time-aware", () => {
  test("add-to-calendar shows for a future lesson, hides once it is past", async ({
    page,
  }) => {
    const email = uniqueEmail("exito");
    await signUp(page, email);
    const userId = await userIdByEmail(email);
    const instructorId = await activeInstructorId();

    const futureConfirmed = await createBooking(
      userId,
      instructorId,
      BookingStatus.CONFIRMED,
      FUTURE_DATE,
    );
    const pastCompleted = await createBooking(
      userId,
      instructorId,
      BookingStatus.COMPLETED,
      PAST_DATE,
    );
    // CONFIRMED but the slot has already passed (not yet swept to COMPLETED).
    const pastConfirmed = await createBooking(
      userId,
      instructorId,
      BookingStatus.CONFIRMED,
      PAST_DATE,
    );

    // Future → the ICS link is offered.
    await page.goto(`/en/reservar/exito/${futureConfirmed}`);
    await expect(page.getByTestId("exito-add-to-calendar")).toBeVisible();
    await expect(page.getByTestId("exito-go-to-dashboard")).toBeVisible();

    // Past (both statuses) → no ICS, dashboard CTA stays.
    for (const id of [pastCompleted, pastConfirmed]) {
      await page.goto(`/en/reservar/exito/${id}`);
      await expect(page.getByTestId("exito-page")).toBeVisible();
      await expect(page.getByTestId("exito-add-to-calendar")).toHaveCount(0);
      await expect(page.getByTestId("exito-go-to-dashboard")).toBeVisible();
    }
  });
});
