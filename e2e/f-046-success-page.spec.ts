import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import {
  PrismaClient,
  BookingStatus,
  Duration,
  Level,
  Locale as DbLocale,
} from "@prisma/client";

// Playwright runs with NODE_ENV=test, which makes Next's loadEnvConfig skip
// .env.local. Read .env.local explicitly so this spec hits the dev Neon
// branch (the one the dev server uses), not whatever .env points at.
loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const ICS_UID_PREFIX = "f-046-";

test.afterAll(async () => {
  // Drop test-owned bookings so F-027 / F-043 (which probe seeded slot
  // availability) do not see this suite's bookings as consumed inventory.
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: ICS_UID_PREFIX } },
  });
  await prisma.$disconnect();
});

type Locale = "en" | "de" | "es";
const LOCALES: Locale[] = ["en", "de", "es"];

// Use a date outside the seeded availability window (F-021 season runs
// 2026-11-15 to 2027-04-30). Bookings written here will not show up to
// F-027 / F-043 availability probes, so the suites can run in parallel.
const BOOKING_DATE = "2027-05-15";
const BOOKING_TIME = "11:00";

const HEADING_CONFIRMED = {
  en: "Your lesson is booked",
  de: "Deine Lektion ist gebucht",
  es: "Tu clase está reservada",
} as const;

const HEADING_PENDING = {
  en: "We're confirming your payment",
  de: "Wir bestätigen die Zahlung",
  es: "Estamos confirmando el pago",
} as const;

const ADD_TO_CALENDAR = {
  en: "Add to calendar",
  de: "Zum Kalender hinzufügen",
  es: "Añadir al calendario",
} as const;

const GO_TO_DASHBOARD = {
  en: "Go to dashboard",
  de: "Zum Dashboard",
  es: "Ir al panel",
} as const;

function uniqueEmail(tag: string) {
  return `f046-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(
  page: Page,
  email: string,
  name = "F-046 Tester",
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
): Promise<string> {
  const uid = `f-046-${userId.slice(-6)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const booking = await prisma.booking.create({
    data: {
      bookerId: userId,
      instructorId,
      date: new Date(`${BOOKING_DATE}T00:00:00.000Z`),
      anchorTime: BOOKING_TIME,
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status,
      totalPriceCents: 8000,
      icsUid: uid,
      attendees: {
        create: [
          {
            name: "F-046 Tester",
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

test.describe("F-046 — Success page anonymous redirect", () => {
  test("anonymous /en/reservar/exito/<id> redirects to login with next= preserving the path", async ({
    page,
  }) => {
    await page.goto("/en/reservar/exito/some-fake-id");
    await page.waitForURL(/\/en\/login\?next=/u);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/en/login");
    expect(url.searchParams.get("next")).toBe(
      "/en/reservar/exito/some-fake-id",
    );
  });
});

test.describe("F-046 — Success page CONFIRMED branch", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/reservar/exito/<id> renders summary + calendar + dashboard CTAs`, async ({
      page,
    }) => {
      const email = uniqueEmail(`conf-${locale}`);
      await signUp(page, email);
      const userId = await findUserIdByEmail(email);
      const instructorId = await pickInstructorId();
      const bookingId = await createBookingFor(
        userId,
        instructorId,
        BookingStatus.CONFIRMED,
      );

      await page.goto(`/${locale}/reservar/exito/${bookingId}`);
      await expect(page.getByTestId("exito-page")).toBeVisible();
      await expect(page.getByTestId("exito-page")).toHaveAttribute(
        "data-status",
        "CONFIRMED",
      );
      await expect(page.getByTestId("exito-heading")).toContainText(
        HEADING_CONFIRMED[locale],
      );
      await expect(page.getByTestId("exito-summary-time")).toHaveText(
        BOOKING_TIME,
      );
      await expect(page.getByTestId("exito-summary-attendees")).toContainText(
        "1",
      );
      const total =
        (await page.getByTestId("exito-summary-total").textContent()) ?? "";
      expect(total).toMatch(/CHF/);
      await expect(page.getByTestId("exito-booking-id")).toHaveText(bookingId);

      const calendar = page.getByTestId("exito-add-to-calendar");
      await expect(calendar).toBeVisible();
      await expect(calendar).toHaveText(ADD_TO_CALENDAR[locale]);
      await expect(calendar).toHaveAttribute(
        "href",
        `/api/booking/${bookingId}/ics`,
      );

      const dashboard = page.getByTestId("exito-go-to-dashboard");
      await expect(dashboard).toBeVisible();
      await expect(dashboard).toHaveText(GO_TO_DASHBOARD[locale]);

      // Pending refresh meta must NOT be present for CONFIRMED.
      await expect(page.getByTestId("exito-pending-meta")).toHaveCount(0);
    });
  }

  test("ICS route returns text/calendar payload for the booker", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("ics");
    await signUp(page, email);
    const userId = await findUserIdByEmail(email);
    const instructorId = await pickInstructorId();
    const bookingId = await createBookingFor(
      userId,
      instructorId,
      BookingStatus.CONFIRMED,
    );

    const res = await request.get(`/api/booking/${bookingId}/ics`, {
      // Inherit page cookies so auth session attaches.
      headers: { cookie: (await page.context().cookies())
        .map((c) => `${c.name}=${c.value}`)
        .join("; ") },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
  });
});

test.describe("F-046 — Success page PENDING branch", () => {
  test("renders pending heading + meta refresh + fallback hint", async ({
    page,
  }) => {
    const email = uniqueEmail("pending");
    await signUp(page, email);
    const userId = await findUserIdByEmail(email);
    const instructorId = await pickInstructorId();
    const bookingId = await createBookingFor(
      userId,
      instructorId,
      BookingStatus.PENDING_PAYMENT,
    );

    await page.goto(`/en/reservar/exito/${bookingId}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("exito-page")).toHaveAttribute(
      "data-status",
      "PENDING_PAYMENT",
    );
    await expect(page.getByTestId("exito-heading")).toContainText(
      HEADING_PENDING.en,
    );
    await expect(page.getByTestId("exito-pending-fallback")).toBeVisible();
    // meta refresh tag rendered server-side; attribute check is reliable
    // without relying on the browser actually executing the refresh.
    const metaCount = await page
      .locator('meta[http-equiv="refresh"][content="3"]')
      .count();
    expect(metaCount).toBeGreaterThanOrEqual(1);
  });
});

test.describe("F-046 — Success page cross-user 403", () => {
  test("second user hitting the first user's booking sees the forbidden panel", async ({
    page,
  }) => {
    // Owner creates a booking.
    const ownerEmail = uniqueEmail("owner");
    await signUp(page, ownerEmail);
    const ownerId = await findUserIdByEmail(ownerEmail);
    const instructorId = await pickInstructorId();
    const bookingId = await createBookingFor(
      ownerId,
      instructorId,
      BookingStatus.CONFIRMED,
    );

    // Clear session and sign in as a different user.
    await page.context().clearCookies();
    const intruderEmail = uniqueEmail("intruder");
    await signUp(page, intruderEmail, "F-046 Intruder");

    await page.goto(`/en/reservar/exito/${bookingId}`);
    await expect(page.getByTestId("exito-forbidden")).toBeVisible();
    await expect(page.getByTestId("exito-page")).toHaveCount(0);
  });
});
