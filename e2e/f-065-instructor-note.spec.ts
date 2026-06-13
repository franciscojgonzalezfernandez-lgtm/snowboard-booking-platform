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

const ICS_UID_PREFIX = "f-065-";

function utcMidnight(daysFromToday: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysFromToday,
    ),
  );
}

function uniqueEmail(tag: string): string {
  return `f065-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F065 Tester");
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

let seq = 0;
async function createBooking(args: {
  bookerId: string;
  instructorId: string;
  date: Date;
  status: BookingStatus;
  instructorNote?: string;
}): Promise<string> {
  seq += 1;
  const booking = await prisma.booking.create({
    data: {
      bookerId: args.bookerId,
      instructorId: args.instructorId,
      date: args.date,
      anchorTime: "09:00",
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: args.status,
      totalPriceCents: 11000,
      instructorNote: args.instructorNote ?? null,
      instructorNoteSetAt: args.instructorNote ? new Date() : null,
      icsUid: `${ICS_UID_PREFIX}${Date.now()}-${seq}@example.test`,
      attendees: {
        create: {
          name: "F065 Pupil",
          birthDate: new Date("2000-01-01"),
          level: Level.BEGINNER,
        },
      },
    },
    select: { id: true },
  });
  return booking.id;
}

test.afterAll(async () => {
  await prisma.booking.deleteMany({
    where: { icsUid: { startsWith: ICS_UID_PREFIX } },
  });
  await prisma.instructor.deleteMany({
    where: { user: { email: { startsWith: "f065-" } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: "f065-" } } });
  await prisma.$disconnect();
});

test("instructor writes a note that persists, and sees booker history", async ({
  page,
}) => {
  const email = uniqueEmail("instr");
  await signUp(page, email);
  const userId = await userIdByEmail(email);

  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.instructor] },
  });
  const instructor = await prisma.instructor.create({
    data: {
      userId,
      bio: "F065 instructor",
      specialties: [],
      languages: [DbLocale.en],
    },
    select: { id: true },
  });

  // Two prior COMPLETED classes (with notes) feed the booker-history panel;
  // they sit before today's window so they don't render as their own rows.
  const noteOld = `F065 oldest — toeside solid ${Date.now()}`;
  const noteRecent = `F065 recent — link turns next time ${Date.now()}`;
  await createBooking({
    bookerId: userId,
    instructorId: instructor.id,
    date: utcMidnight(-30),
    status: BookingStatus.COMPLETED,
    instructorNote: noteOld,
  });
  await createBooking({
    bookerId: userId,
    instructorId: instructor.id,
    date: utcMidnight(-20),
    status: BookingStatus.COMPLETED,
    instructorNote: noteRecent,
  });
  // Today's COMPLETED class — the row that gets the inline editor.
  await createBooking({
    bookerId: userId,
    instructorId: instructor.id,
    date: utcMidnight(0),
    status: BookingStatus.COMPLETED,
  });

  await page.goto("/instructor");

  const completedRow = page.locator(
    '[data-testid="agenda-booking-row"][data-status="COMPLETED"]',
  );
  await expect(completedRow).toHaveCount(1);

  // Write the note + flush the debounce by blurring; expect the saved state.
  const noteText = `F065 today — strong, push carving ${Date.now()}`;
  const input = completedRow.getByTestId("instructor-note-input");
  await input.fill(noteText);
  await input.blur();
  await expect(completedRow.getByTestId("instructor-note-status")).toHaveText(
    "Saved",
  );

  // Reload → value persisted from the DB.
  await page.reload();
  const reloadedRow = page.locator(
    '[data-testid="agenda-booking-row"][data-status="COMPLETED"]',
  );
  await expect(reloadedRow.getByTestId("instructor-note-input")).toHaveValue(
    noteText,
  );

  // Booker history lists the two prior notes (newest first), not today's.
  const history = reloadedRow.getByTestId("booker-history");
  await expect(history).toContainText("2 previous notes for this client");
  await history.locator("summary").click();
  const entries = history.getByTestId("booker-history-entry");
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toContainText(noteRecent);
  await expect(entries.nth(1)).toContainText(noteOld);
  await expect(history).not.toContainText(noteText);

  // Internal-only: the note never appears on the booker's dashboard.
  await page.goto("/dashboard");
  await expect(page.locator("body")).not.toContainText(noteText);
});
