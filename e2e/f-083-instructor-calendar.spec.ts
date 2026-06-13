import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import {
  AvailabilityKind,
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

const ICS_UID_PREFIX = "f-083-";
const EMAIL_PREFIX = "f083-";

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUpAsInstructor(page: Page): Promise<{
  userId: string;
  instructorId: string;
}> {
  const email = uniqueEmail("instr");
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F083 Tester");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
  await page.getByTestId("submit-credentials").click();
  await page.waitForURL(/\/(en|de|es)\/?$/);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`User not found after signup: ${email}`);

  await prisma.user.update({
    where: { id: user.id },
    data: { roles: [Role.student, Role.instructor] },
  });
  const instructor = await prisma.instructor.create({
    data: {
      userId: user.id,
      bio: "F083 instructor",
      specialties: [],
      languages: [DbLocale.en],
    },
    select: { id: true },
  });
  return { userId: user.id, instructorId: instructor.id };
}

/** An in-season UTC date, offset so concurrent tests don't collide on a day. */
async function inSeasonDate(offsetDays = 0): Promise<Date> {
  const season = await prisma.season.findFirst({
    where: { active: true },
    select: { startDate: true, endDate: true },
  });
  if (!season) throw new Error("No active season seeded — cannot run F-083 e2e");
  const now = new Date();
  const candidate = now > season.startDate ? now : season.startDate;
  const base = new Date(
    Date.UTC(
      candidate.getUTCFullYear(),
      candidate.getUTCMonth(),
      candidate.getUTCDate(),
    ),
  );
  base.setUTCDate(base.getUTCDate() + 14 + offsetDays);
  if (base > season.endDate) {
    throw new Error("Computed F-083 e2e date falls outside active season");
  }
  return base;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** UTC-midnight Monday of the week containing `d` (mirrors lib/calendar mondayOf). */
function mondayIso(d: Date): string {
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const back = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - back);
  return isoDate(start);
}

function openBlock(day: Date, instructorId: string) {
  const startDateTime = new Date(day);
  startDateTime.setUTCHours(8, 0, 0, 0);
  const endDateTime = new Date(day);
  endDateTime.setUTCHours(17, 0, 0, 0);
  return prisma.availabilityBlock.create({
    data: { instructorId, startDateTime, endDateTime, kind: AvailabilityKind.AVAILABLE },
    select: { id: true },
  });
}

function weekUrl(day: Date): string {
  return `/instructor/calendar?view=week&week=${mondayIso(day)}`;
}

test.afterAll(async () => {
  await prisma.attendee.deleteMany({
    where: { booking: { icsUid: { startsWith: ICS_UID_PREFIX } } },
  });
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: ICS_UID_PREFIX } },
  });
  await prisma.availabilityBlock.deleteMany({
    where: { instructor: { user: { email: { startsWith: EMAIL_PREFIX } } } },
  });
  await prisma.instructor.deleteMany({
    where: { user: { email: { startsWith: EMAIL_PREFIX } } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
  });
  await prisma.$disconnect();
});

test("Month/Week toggle switches views and the week timeline paints bookings", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { userId, instructorId } = await signUpAsInstructor(page);
  const day = await inSeasonDate(0);
  await openBlock(day, instructorId);
  await prisma.booking.create({
    data: {
      bookerId: userId,
      instructorId,
      date: day,
      anchorTime: "10:00",
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: BookingStatus.CONFIRMED,
      totalPriceCents: 11000,
      icsUid: `${ICS_UID_PREFIX}paint-${day.getTime()}@example.test`,
      attendees: {
        create: {
          name: "F083 Pupil",
          birthDate: new Date("2000-01-01"),
          level: Level.BEGINNER,
        },
      },
    },
  });

  // Toggle works from the default Month view.
  await page.goto("/instructor/calendar");
  await expect(page.getByTestId("calendar-view-toggle")).toBeVisible();
  await page.getByTestId("calendar-view-week").click();
  await expect(page.getByTestId("week-calendar")).toBeVisible();

  // The seeded week renders the booking block + the day reads as locked.
  await page.goto(weekUrl(day));
  await expect(page.getByTestId("week-calendar")).toBeVisible();
  const iso = isoDate(day);
  await expect(page.getByTestId(`week-locked-${iso}`)).toContainText("booked");
  await expect(
    page.locator('[data-testid^="week-booking-"]').first(),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid^="week-booking-"]').first(),
  ).toContainText("10:00");
});

test("instructor blocks a window from the week timeline dialog", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { instructorId } = await signUpAsInstructor(page);
  const day = await inSeasonDate(1);
  await openBlock(day, instructorId);
  const iso = isoDate(day);

  await page.goto(weekUrl(day));
  await page.getByTestId(`week-block-${iso}`).click();
  await expect(page.getByTestId("week-block-dialog")).toBeVisible();
  await page.getByTestId("week-block-start").fill("10:00");
  await page.getByTestId("week-block-end").fill("12:00");
  await page.getByTestId("week-block-confirm").click();

  await expect(
    page.locator('[data-testid^="week-blocked-"]').first(),
  ).toContainText("10:00–12:00");

  const blocked = await prisma.availabilityBlock.findMany({
    where: { instructorId, kind: AvailabilityKind.BLOCKED },
    select: { startDateTime: true, endDateTime: true },
  });
  expect(blocked).toHaveLength(1);
  expect(blocked[0]!.startDateTime.getUTCHours()).toBe(10);
  expect(blocked[0]!.endDateTime.getUTCHours()).toBe(12);
});

test("removing a blocked window asks for confirmation, then clears it", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { instructorId } = await signUpAsInstructor(page);
  const day = await inSeasonDate(2);
  await openBlock(day, instructorId);
  const blockStart = new Date(day);
  blockStart.setUTCHours(13, 0, 0, 0);
  const blockEnd = new Date(day);
  blockEnd.setUTCHours(15, 0, 0, 0);
  const block = await prisma.availabilityBlock.create({
    data: {
      instructorId,
      startDateTime: blockStart,
      endDateTime: blockEnd,
      kind: AvailabilityKind.BLOCKED,
    },
    select: { id: true },
  });

  await page.goto(weekUrl(day));
  await page.getByTestId(`week-blocked-${block.id}`).click();
  await expect(page.getByTestId("week-clear-dialog")).toBeVisible();
  await page.getByTestId("week-clear-confirm").click();

  await expect(page.getByTestId(`week-blocked-${block.id}`)).toHaveCount(0);
  const after = await prisma.availabilityBlock.findUnique({
    where: { id: block.id },
    select: { id: true },
  });
  expect(after).toBeNull();
});
