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

const EMAIL_PREFIX = "f077-";

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, name: string): Promise<{ userId: string; email: string }> {
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

async function signUpAsAdmin(page: Page): Promise<{
  userId: string;
  email: string;
  instructorId: string;
}> {
  const { userId, email } = await signUp(page, "F077 Admin");
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.instructor, Role.admin] },
  });
  const instructor = await prisma.instructor.create({
    data: {
      userId,
      bio: "F077 admin-instructor",
      specialties: [],
      languages: [DbLocale.en],
    },
    select: { id: true },
  });
  return { userId, email, instructorId: instructor.id };
}

async function seedBooking({
  instructorId,
  bookerId,
  status,
  daysFromNow,
  anchorTime = "10:00",
}: {
  instructorId: string;
  bookerId: string;
  status: BookingStatus;
  daysFromNow: number;
  anchorTime?: string;
}): Promise<string> {
  const now = new Date();
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow),
  );
  const tag = Math.random().toString(36).slice(2, 8);
  const booking = await prisma.booking.create({
    data: {
      instructorId,
      bookerId,
      date,
      anchorTime,
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status,
      totalPriceCents: 11000,
      chargeAmountCents: status === BookingStatus.CONFIRMED ? 11000 : null,
      paidAt: status === BookingStatus.CONFIRMED ? new Date() : null,
      icsUid: `f077-${tag}@example.test`,
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
  await prisma.attendee.deleteMany({
    where: { booking: { icsUid: { startsWith: "f077-" } } },
  });
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: "f077-" } },
  });
  await prisma.instructor.deleteMany({
    where: { user: { email: { startsWith: EMAIL_PREFIX } } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
  });
  await prisma.$disconnect();
});

test("non-admin is denied the admin bookings area (404)", async ({ page }) => {
  test.setTimeout(60_000);
  await signUp(page, "F077 Student");
  const res = await page.goto("/admin/bookings");
  expect(res?.status()).toBe(404);
});

test("admin sees the bookings list, filters by status, and opens a detail", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const { userId: adminId, email: adminEmail, instructorId } =
    await signUpAsAdmin(page);

  // Seed a confirmed booking + a cancelled one with the admin as booker. The
  // admin's email is unique, so we filter by `q=<adminEmail>` to isolate our
  // rows from any pre-existing bookings in the dev DB.
  const confirmedId = await seedBooking({
    instructorId,
    bookerId: adminId,
    status: BookingStatus.CONFIRMED,
    daysFromNow: 7,
    anchorTime: "10:00",
  });
  await seedBooking({
    instructorId,
    bookerId: adminId,
    status: BookingStatus.CANCELLED_BY_USER,
    daysFromNow: 5,
    anchorTime: "11:00",
  });

  await page.goto(`/admin/bookings?q=${encodeURIComponent(adminEmail)}`);
  await expect(page.getByTestId("admin-bookings-list")).toBeVisible({
    timeout: 30_000,
  });

  const list = page.getByTestId("admin-bookings-list");
  await expect(list.getByTestId("admin-booking-row")).toHaveCount(2);

  // Narrow to CONFIRMED only (keeping the q filter via the form's other fields).
  await page.getByTestId("admin-bookings-status").selectOption("CONFIRMED");
  await page.getByTestId("admin-bookings-submit").click();
  await page.waitForURL(/\/admin\/bookings\?.*status=CONFIRMED/);

  await expect(list.getByTestId("admin-booking-row")).toHaveCount(1);
  await expect(
    list.locator('[data-testid="admin-booking-row"][data-status="CONFIRMED"]'),
  ).toHaveCount(1);

  // Open the detail page.
  await list.getByTestId("admin-booking-link").first().click();
  await page.waitForURL(`/admin/bookings/${confirmedId}`);

  await expect(page.getByTestId("admin-booking-detail-status")).toHaveText("Confirmed");
  await expect(page.getByTestId("admin-detail-total")).toContainText("110");
  await expect(page.getByTestId("admin-detail-attendees")).toBeVisible();
  await expect(page.getByTestId("admin-detail-attendee")).toHaveCount(1);

  // The ops-cancel placeholder is rendered disabled (not wired until F-078).
  const opsBtn = page.getByTestId("admin-detail-action-ops-cancel");
  await expect(opsBtn).toBeVisible();
  await expect(opsBtn).toBeDisabled();
});
