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

// Use a date outside the seeded availability window (F-021 season runs
// 2026-11-15 to 2027-04-30) so dashboard rows do not collide with the
// availability suites if they run in parallel.
const BOOKING_DATE = "2027-05-16";
const BOOKING_TIME = "10:00";

// `heading_personal` ICU template renders the booker's first name as a
// greeting. Asserting the localized prefix is enough to confirm the
// personalized heading rendered without coupling the spec to the exact
// signup name.
const HEADING_GREETING_PREFIX = {
  en: "Welcome back,",
  de: "Willkommen zurück,",
  es: "Hola de nuevo,",
} as const;

const EMPTY_HEADING = {
  en: "No bookings yet",
  de: "Noch keine Buchungen",
  es: "Aún no tienes reservas",
} as const;

const EMPTY_CTA = {
  en: "Book your first lesson",
  de: "Erste Lektion buchen",
  es: "Reserva tu primera clase",
} as const;

const STATUS_CONFIRMED = {
  en: "Confirmed",
  de: "Bestätigt",
  es: "Confirmada",
} as const;

const PERSONAL_PHONE_MISSING = {
  en: "Not provided",
  de: "Nicht angegeben",
  es: "No indicado",
} as const;

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

test.describe("F-047 — Dashboard empty state", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/dashboard renders empty state + book-first CTA when no bookings exist`, async ({
      page,
    }) => {
      const email = uniqueEmail(`empty-${locale}`);
      await signUp(page, email);
      await page.goto(`/${locale}/dashboard`);

      await expect(page.getByTestId("dashboard-page")).toBeVisible();
      await expect(page.getByTestId("dashboard-heading")).toContainText(
        HEADING_GREETING_PREFIX[locale],
      );

      await expect(page.getByTestId("dashboard-empty")).toBeVisible();
      await expect(page.getByTestId("dashboard-empty-heading")).toHaveText(
        EMPTY_HEADING[locale],
      );
      const cta = page.getByTestId("dashboard-empty-cta");
      await expect(cta).toBeVisible();
      await expect(cta).toHaveText(EMPTY_CTA[locale]);
      await expect(cta).toHaveAttribute("href", `/${locale}/reservar`);

      // Bookings list must NOT render in empty state.
      await expect(page.getByTestId("dashboard-bookings")).toHaveCount(0);

      // Personal data block renders with the signup email + missing phone.
      await expect(page.getByTestId("dashboard-account-email")).toHaveText(
        email,
      );
      await expect(page.getByTestId("dashboard-account-phone")).toHaveText(
        PERSONAL_PHONE_MISSING[locale],
      );
    });
  }
});

test.describe("F-047 — Dashboard with bookings", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/dashboard lists the booker's visible bookings ordered desc with status + total`, async ({
      page,
    }) => {
      const email = uniqueEmail(`list-${locale}`);
      await signUp(page, email);
      const userId = await findUserIdByEmail(email);
      const instructorId = await pickInstructorId();

      // Two rows on distinct dates so we can assert descending order.
      const olderBookingId = await createBookingFor(
        userId,
        instructorId,
        BookingStatus.COMPLETED,
        0,
      );
      const newerBookingId = await createBookingFor(
        userId,
        instructorId,
        BookingStatus.CONFIRMED,
        7,
      );

      await page.goto(`/${locale}/dashboard`);

      const rows = page.getByTestId("dashboard-booking-row");
      await expect(rows).toHaveCount(2);

      // First row = newer booking (desc by date).
      await expect(rows.nth(0)).toHaveAttribute(
        "data-booking-id",
        newerBookingId,
      );
      await expect(rows.nth(0)).toHaveAttribute("data-status", "CONFIRMED");
      await expect(rows.nth(1)).toHaveAttribute(
        "data-booking-id",
        olderBookingId,
      );
      await expect(rows.nth(1)).toHaveAttribute("data-status", "COMPLETED");

      // Confirmed badge renders the localized label.
      await expect(
        rows.nth(0).getByTestId("dashboard-booking-status"),
      ).toHaveText(STATUS_CONFIRMED[locale]);

      // Total formatted as CHF.
      await expect(
        rows.nth(0).getByTestId("dashboard-booking-total"),
      ).toContainText("CHF");

      // Details link points to the per-booking success page.
      const detailsLink = rows.nth(0).getByTestId("dashboard-booking-link");
      await expect(detailsLink).toHaveAttribute(
        "href",
        `/${locale}/reservar/exito/${newerBookingId}`,
      );

      // Empty state must NOT render when there are bookings.
      await expect(page.getByTestId("dashboard-empty")).toHaveCount(0);
    });
  }
});

test.describe("F-047 — Dashboard hides non-actionable statuses", () => {
  test("PENDING_PAYMENT, PAYMENT_FAILED and CANCELLED_BY_SYSTEM bookings are not surfaced", async ({
    page,
  }) => {
    const email = uniqueEmail("hidden");
    await signUp(page, email);
    const userId = await findUserIdByEmail(email);
    const instructorId = await pickInstructorId();

    // Three non-actionable rows that must stay hidden.
    await createBookingFor(
      userId,
      instructorId,
      BookingStatus.PENDING_PAYMENT,
      0,
    );
    await createBookingFor(
      userId,
      instructorId,
      BookingStatus.PAYMENT_FAILED,
      1,
    );
    await createBookingFor(
      userId,
      instructorId,
      BookingStatus.CANCELLED_BY_SYSTEM,
      2,
    );
    // One actionable row to confirm the filter is not pruning everything.
    const confirmedId = await createBookingFor(
      userId,
      instructorId,
      BookingStatus.CONFIRMED,
      3,
    );

    await page.goto("/en/dashboard");

    const rows = page.getByTestId("dashboard-booking-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toHaveAttribute("data-booking-id", confirmedId);
    await expect(rows.nth(0)).toHaveAttribute("data-status", "CONFIRMED");
  });
});

test.describe("F-047 — Dashboard isolation", () => {
  test("only shows bookings belonging to the signed-in user", async ({
    page,
  }) => {
    const instructorId = await pickInstructorId();

    // User A — owns one booking.
    const aEmail = uniqueEmail("isolation-a");
    await signUp(page, aEmail);
    const aId = await findUserIdByEmail(aEmail);
    await createBookingFor(aId, instructorId, BookingStatus.CONFIRMED);

    // User B — owns zero bookings.
    await page.context().clearCookies();
    const bEmail = uniqueEmail("isolation-b");
    await signUp(page, bEmail, "F047 Other");

    await page.goto("/en/dashboard");
    await expect(page.getByTestId("dashboard-empty")).toBeVisible();
    await expect(page.getByTestId("dashboard-bookings")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-account-email")).toHaveText(
      bEmail,
    );
  });
});
