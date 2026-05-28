import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import {
  PrismaClient,
  BookingStatus,
  Duration,
  Level,
  Locale as DbLocale,
  Role,
} from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const ICS_UID_PREFIX = "f-071-";
const ANCHOR_TIME = "09:00";
const ATTENDEE_NAME = "Agenda Test Pupil";

// Today at UTC midnight — Booking.date is @db.Date and the agenda's default
// window starts at today, so a class created here lands on the first day.
function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function uniqueEmail(tag: string): string {
  return `f071-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F071 Tester");
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

test.afterAll(async () => {
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: ICS_UID_PREFIX } },
  });
  await prisma.instructor.deleteMany({
    where: { user: { email: { startsWith: "f071-" } } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "f071-" } },
  });
  await prisma.$disconnect();
});

test("anonymous visitor is redirected to login", async ({ page }) => {
  await page.goto("/instructor");
  await expect(page).toHaveURL(/\/en\/login/);
});

test("authenticated non-instructor gets a 404", async ({ page }) => {
  const email = uniqueEmail("student");
  await signUp(page, email);
  const res = await page.goto("/instructor");
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("instructor-agenda")).toHaveCount(0);
});

test("instructor sees today's class on the agenda", async ({ page }) => {
  const email = uniqueEmail("instr");
  await signUp(page, email);
  const userId = await userIdByEmail(email);

  // Promote the freshly signed-up user to an instructor with a profile, then
  // give them a confirmed class today. requireInstructor re-reads roles from
  // the DB on every request, so the existing session picks this up on reload.
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.instructor] },
  });
  const instructor = await prisma.instructor.create({
    data: {
      userId,
      bio: "F071 instructor",
      specialties: [],
      languages: [DbLocale.en],
    },
    select: { id: true },
  });
  await prisma.booking.create({
    data: {
      bookerId: userId,
      instructorId: instructor.id,
      date: todayUtcMidnight(),
      anchorTime: ANCHOR_TIME,
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: BookingStatus.CONFIRMED,
      totalPriceCents: 11000,
      icsUid: `${ICS_UID_PREFIX}${Date.now()}@example.test`,
      attendees: {
        create: { name: ATTENDEE_NAME, birthDate: new Date("2000-01-01"), level: Level.BEGINNER },
      },
    },
  });

  await page.goto("/instructor");
  await expect(page.getByTestId("instructor-agenda")).toBeVisible();

  const row = page.getByTestId("agenda-booking-row").first();
  await expect(row).toBeVisible();
  await expect(row.getByTestId("agenda-booking-time")).toContainText(ANCHOR_TIME);
  await expect(row.getByTestId("agenda-booking-attendees")).toContainText(
    ATTENDEE_NAME,
  );
  // The first day section is today.
  await expect(page.getByTestId("agenda-day").first()).toContainText("Today");
});
