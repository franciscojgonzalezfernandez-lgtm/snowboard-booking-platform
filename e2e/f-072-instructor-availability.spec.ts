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

const ICS_UID_PREFIX = "f-072-";
const EMAIL_PREFIX = "f072-";

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
  await page.getByTestId("input-name").fill("F072 Tester");
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
      bio: "F072 instructor",
      specialties: [],
      languages: [DbLocale.en],
    },
    select: { id: true },
  });
  return { userId: user.id, instructorId: instructor.id };
}

/** Pick an in-season UTC date safely inside the active season, sliding off a
 * given offset so two tests don't pick the same day and collide on overlap. */
async function inSeasonDate(offsetDays = 0): Promise<Date> {
  const season = await prisma.season.findFirst({
    where: { active: true },
    select: { startDate: true, endDate: true },
  });
  if (!season) throw new Error("No active season seeded — cannot run F-072 e2e");
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
    throw new Error("Computed F-072 e2e date falls outside active season");
  }
  return base;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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

test("instructor creates a future availability window and it appears in the list", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await signUpAsInstructor(page);
  const day = await inSeasonDate(0);

  await page.goto("/instructor/availability");
  await expect(page.getByTestId("instructor-availability")).toBeVisible();
  await expect(page.getByTestId("availability-list-empty")).toBeVisible();

  await page.getByTestId("availability-date").fill(isoDate(day));
  await page.getByTestId("availability-start").fill("09:00");
  await page.getByTestId("availability-end").fill("17:00");
  await page.getByTestId("availability-create-submit").click();

  await expect(page.getByTestId("availability-list")).toBeVisible();
  await expect(page.getByTestId("availability-list-item")).toHaveCount(1);
  await expect(page.getByTestId("availability-list-item")).toContainText(
    "09:00",
  );
  await expect(page.getByTestId("availability-list-item")).toContainText(
    "17:00",
  );
});

test("delete removes the row and frees the day for a re-add", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { instructorId } = await signUpAsInstructor(page);
  const day = await inSeasonDate(1);
  const startDateTime = new Date(day);
  startDateTime.setUTCHours(9, 0, 0, 0);
  const endDateTime = new Date(day);
  endDateTime.setUTCHours(17, 0, 0, 0);
  await prisma.availabilityBlock.create({
    data: { instructorId, startDateTime, endDateTime, kind: AvailabilityKind.AVAILABLE },
  });

  await page.goto("/instructor/availability");
  await expect(page.getByTestId("availability-list-item")).toHaveCount(1);

  const row = page.getByTestId("availability-list-item").first();
  const blockId = await row.getAttribute("data-block-id");
  await page.getByTestId(`availability-delete-${blockId}`).click();
  await expect(page.getByTestId("availability-delete-dialog")).toBeVisible();
  await page.getByTestId("availability-delete-confirm").click();

  await expect(page.getByTestId("availability-list-empty")).toBeVisible();
});

test("overlap with an existing window is rejected with an inline error", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { instructorId } = await signUpAsInstructor(page);
  const day = await inSeasonDate(2);
  const startDateTime = new Date(day);
  startDateTime.setUTCHours(9, 0, 0, 0);
  const endDateTime = new Date(day);
  endDateTime.setUTCHours(12, 0, 0, 0);
  await prisma.availabilityBlock.create({
    data: { instructorId, startDateTime, endDateTime, kind: AvailabilityKind.AVAILABLE },
  });

  await page.goto("/instructor/availability");
  await page.getByTestId("availability-date").fill(isoDate(day));
  await page.getByTestId("availability-start").fill("10:00");
  await page.getByTestId("availability-end").fill("13:00");
  await page.getByTestId("availability-create-submit").click();

  await expect(page.getByTestId("availability-create-error")).toContainText(
    /overlap/i,
  );
  // List unchanged.
  await expect(page.getByTestId("availability-list-item")).toHaveCount(1);
});

test("delete is rejected when the window contains a CONFIRMED booking", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { userId, instructorId } = await signUpAsInstructor(page);
  const day = await inSeasonDate(3);
  const startDateTime = new Date(day);
  startDateTime.setUTCHours(9, 0, 0, 0);
  const endDateTime = new Date(day);
  endDateTime.setUTCHours(17, 0, 0, 0);
  const block = await prisma.availabilityBlock.create({
    data: { instructorId, startDateTime, endDateTime, kind: AvailabilityKind.AVAILABLE },
    select: { id: true },
  });
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
      icsUid: `${ICS_UID_PREFIX}${block.id}@example.test`,
      attendees: {
        create: {
          name: "F072 Pupil",
          birthDate: new Date("2000-01-01"),
          level: Level.BEGINNER,
        },
      },
    },
  });

  await page.goto("/instructor/availability");

  // The row flags the booking and the Delete control is blocked up front, so
  // the instructor never opens a modal that promises a delete the server guard
  // would refuse.
  await expect(page.getByTestId("availability-has-booking")).toBeVisible();
  await expect(
    page.getByTestId(`availability-delete-${block.id}`),
  ).toBeDisabled();
  await expect(page.getByTestId("availability-list-item")).toHaveCount(1);
});
