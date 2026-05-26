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

const ICS_UID_PREFIX = "f-057-";

test.afterAll(async () => {
  // Credits delete first (FK references the booking).
  await prisma.accountCredit.deleteMany({
    where: { sourceBooking: { icsUid: { startsWith: ICS_UID_PREFIX } } },
  });
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: ICS_UID_PREFIX } },
  });
  await prisma.$disconnect();
});

type Locale = "en" | "de" | "es";
const LOCALES: Locale[] = ["en", "de", "es"];

const FUTURE_UPCOMING_DATE = "2027-01-15";
const FUTURE_CANCELLED_DATE = "2027-02-20";
const PAST_COMPLETED_DATE = "2026-04-15";
const BOOKING_TIME = "10:00";

const SECTION_HEADING = {
  en: { upcoming: "Upcoming", past: "Past", cancelled: "Cancelled" },
  de: { upcoming: "Anstehend", past: "Vergangen", cancelled: "Storniert" },
  es: { upcoming: "Próximas", past: "Pasadas", cancelled: "Canceladas" },
} as const;

const EMPTY_UPCOMING_CTA = {
  en: "Book a lesson",
  de: "Lektion buchen",
  es: "Reservar una clase",
} as const;

const ADD_TO_CALENDAR = {
  en: "Add to calendar",
  de: "Zum Kalender hinzufügen",
  es: "Añadir al calendario",
} as const;

function uniqueEmail(tag: string) {
  return `f057-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(
  page: Page,
  email: string,
  name = "F057 Tester",
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
): Promise<{ bookingId: string; creditId: string | null }> {
  const uid = `f-057-${spec.tag}-${userId.slice(-6)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
            name: "F-057 Tester",
            birthDate: new Date("1990-01-01T00:00:00.000Z"),
            level: Level.INTERMEDIATE,
            isBooker: true,
          },
        ],
      },
    },
    select: { id: true },
  });

  let creditId: string | null = null;
  if (spec.withCredit) {
    const credit = await prisma.accountCredit.create({
      data: {
        userId,
        amountCents: 11000,
        sourceBookingId: booking.id,
        reason: CreditReason.USER_CANCEL,
        status: CreditStatus.ACTIVE,
        expiresAt: new Date("2027-12-31T00:00:00.000Z"),
      },
      select: { id: true },
    });
    creditId = credit.id;
  }

  return { bookingId: booking.id, creditId };
}

test.describe("F-057 — Dashboard grouped sections", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/dashboard renders Upcoming + Past + Cancelled with correct counts and routing`, async ({
      page,
    }) => {
      const email = uniqueEmail(`sections-${locale}`);
      await signUp(page, email);
      const userId = await findUserIdByEmail(email);
      const instructorId = await pickInstructorId();

      const upcoming = await seedBooking(userId, instructorId, {
        status: BookingStatus.CONFIRMED,
        date: FUTURE_UPCOMING_DATE,
        tag: `up-${locale}`,
      });
      const past = await seedBooking(userId, instructorId, {
        status: BookingStatus.COMPLETED,
        date: PAST_COMPLETED_DATE,
        tag: `past-${locale}`,
      });
      const cancelled = await seedBooking(userId, instructorId, {
        status: BookingStatus.CANCELLED_BY_USER,
        date: FUTURE_CANCELLED_DATE,
        tag: `cx-${locale}`,
        cancelledByUserAt: new Date("2026-05-20T10:00:00.000Z"),
        withCredit: true,
      });

      await page.goto(`/${locale}/dashboard`);

      // Three section containers always render — even empty ones.
      for (const kind of ["upcoming", "past", "cancelled"] as const) {
        const section = page.getByTestId(`dashboard-section-${kind}`);
        await expect(section).toBeVisible();
        await expect(
          page.getByTestId(`dashboard-section-heading-${kind}`),
        ).toHaveText(SECTION_HEADING[locale][kind]);
      }

      // Counts.
      await expect(
        page.getByTestId("dashboard-section-count-upcoming"),
      ).toHaveText("1");
      await expect(
        page.getByTestId("dashboard-section-count-past"),
      ).toHaveText("1");
      await expect(
        page.getByTestId("dashboard-section-count-cancelled"),
      ).toHaveText("1");

      // Each booking lives in the correct section's <ol>.
      await expect(
        page
          .getByTestId("dashboard-bookings-upcoming")
          .getByTestId("dashboard-booking-row"),
      ).toHaveCount(1);
      await expect(
        page
          .getByTestId("dashboard-bookings-upcoming")
          .locator(`[data-booking-id="${upcoming.bookingId}"]`),
      ).toBeVisible();

      await expect(
        page
          .getByTestId("dashboard-bookings-past")
          .locator(`[data-booking-id="${past.bookingId}"]`),
      ).toBeVisible();

      await expect(
        page
          .getByTestId("dashboard-bookings-cancelled")
          .locator(`[data-booking-id="${cancelled.bookingId}"]`),
      ).toBeVisible();

      // Past COMPLETED row offers an Add to calendar link → .ics API route.
      const pastRow = page.locator(`[data-booking-id="${past.bookingId}"]`);
      const icsLink = pastRow.getByTestId("dashboard-booking-ics");
      await expect(icsLink).toBeVisible();
      await expect(icsLink).toContainText(ADD_TO_CALENDAR[locale]);
      await expect(icsLink).toHaveAttribute(
        "href",
        `/api/booking/${past.bookingId}/ics`,
      );

      // Cancelled row surfaces the linked AccountCredit (amount + expiry).
      const cancelledRow = page.locator(
        `[data-booking-id="${cancelled.bookingId}"]`,
      );
      const creditMeta = cancelledRow.getByTestId(
        "dashboard-booking-credit-issued",
      );
      await expect(creditMeta).toBeVisible();
      await expect(creditMeta).toContainText("CHF");
      await expect(creditMeta).toContainText("110");

      // Cancelled row also surfaces the cancelled-on date.
      await expect(
        cancelledRow.getByTestId("dashboard-booking-cancelled-at"),
      ).toBeVisible();

      // Upcoming + Past rows do NOT carry the cancelled-meta block.
      await expect(
        page
          .locator(`[data-booking-id="${upcoming.bookingId}"]`)
          .getByTestId("dashboard-booking-cancelled-meta"),
      ).toHaveCount(0);
    });
  }
});

test.describe("F-057 — Dashboard empty states per section", () => {
  test("zero bookings render an empty state in every section + CTA only in upcoming", async ({
    page,
  }) => {
    const email = uniqueEmail("empty");
    await signUp(page, email);

    await page.goto("/en/dashboard");

    await expect(page.getByTestId("dashboard-empty-upcoming")).toBeVisible();
    await expect(page.getByTestId("dashboard-empty-past")).toBeVisible();
    await expect(page.getByTestId("dashboard-empty-cancelled")).toBeVisible();

    const cta = page.getByTestId("dashboard-empty-upcoming-cta");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText(EMPTY_UPCOMING_CTA.en);
    await expect(cta).toHaveAttribute("href", "/en/reservar");

    // Counts read 0 across the board.
    await expect(
      page.getByTestId("dashboard-section-count-upcoming"),
    ).toHaveText("0");
    await expect(
      page.getByTestId("dashboard-section-count-past"),
    ).toHaveText("0");
    await expect(
      page.getByTestId("dashboard-section-count-cancelled"),
    ).toHaveText("0");

    // No booking rows render.
    await expect(page.getByTestId("dashboard-booking-row")).toHaveCount(0);
  });
});

test.describe("F-057 — Dashboard hides PENDING_PAYMENT drafts", () => {
  test("PENDING_PAYMENT bookings are excluded from every section", async ({
    page,
  }) => {
    const email = uniqueEmail("pending");
    await signUp(page, email);
    const userId = await findUserIdByEmail(email);
    const instructorId = await pickInstructorId();

    await seedBooking(userId, instructorId, {
      status: BookingStatus.PENDING_PAYMENT,
      date: FUTURE_UPCOMING_DATE,
      tag: "pending",
    });
    const confirmed = await seedBooking(userId, instructorId, {
      status: BookingStatus.CONFIRMED,
      date: FUTURE_UPCOMING_DATE,
      tag: "confirmed",
    });

    await page.goto("/en/dashboard");

    const rows = page.getByTestId("dashboard-booking-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute(
      "data-booking-id",
      confirmed.bookingId,
    );
  });
});

test.describe("F-057 — Dashboard surfaces PAYMENT_FAILED + CANCELLED_BY_SYSTEM in cancelled", () => {
  test("non-PENDING_PAYMENT failure/system rows land in the Cancelled section", async ({
    page,
  }) => {
    const email = uniqueEmail("failed");
    await signUp(page, email);
    const userId = await findUserIdByEmail(email);
    const instructorId = await pickInstructorId();

    const failed = await seedBooking(userId, instructorId, {
      status: BookingStatus.PAYMENT_FAILED,
      date: FUTURE_UPCOMING_DATE,
      tag: "failed",
    });
    const systemCancelled = await seedBooking(userId, instructorId, {
      status: BookingStatus.CANCELLED_BY_SYSTEM,
      date: FUTURE_UPCOMING_DATE,
      tag: "syscx",
    });

    await page.goto("/en/dashboard");

    const cancelledList = page.getByTestId("dashboard-bookings-cancelled");
    await expect(
      cancelledList.locator(`[data-booking-id="${failed.bookingId}"]`),
    ).toBeVisible();
    await expect(
      cancelledList.locator(
        `[data-booking-id="${systemCancelled.bookingId}"]`,
      ),
    ).toBeVisible();
  });
});
