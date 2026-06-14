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

// Serial: these tests create users + bookings and immediately read them back
// through the running app. Run in parallel against one dev server + shared Neon
// dev branch they contend and intermittently miss freshly-written rows. They
// are independent enough to also run alone, but never concurrently here.
test.describe.configure({ mode: "serial" });

const EMAIL_PREFIX = "f087-";
const ICS_UID_PREFIX = "f-087-";

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

function utcMidnight(daysFromToday: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromToday),
  );
}

async function signUp(page: Page, name: string, email: string): Promise<string> {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill(name);
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
  await page.getByTestId("submit-credentials").click();
  await page.waitForURL(/\/(en|de|es)\/?$/);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`User not found after signup: ${email}`);
  return user.id;
}

/** Sign up a fresh user and promote them to admin (their own isolated session). */
async function signUpAsAdmin(page: Page): Promise<void> {
  const email = uniqueEmail("admin");
  const userId = await signUp(page, "F087 Admin", email);
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.instructor, Role.admin] },
  });
}

async function createInstructor(name: string): Promise<{ id: string }> {
  const user = await prisma.user.create({
    data: {
      email: uniqueEmail("inst"),
      name,
      roles: [Role.instructor],
      emailVerified: true,
      instructor: { create: { bio: `${name} bio`, specialties: [], languages: [DbLocale.en] } },
    },
    select: { instructor: { select: { id: true } } },
  });
  if (!user.instructor) throw new Error("instructor not created");
  return user.instructor;
}

async function createBookerUser(name: string, email: string): Promise<string> {
  const user = await prisma.user.create({
    data: { email, name, roles: [Role.student], emailVerified: true },
    select: { id: true },
  });
  return user.id;
}

let seq = 0;
async function createBooking(args: {
  bookerId: string;
  instructorId: string;
  date: Date;
  status: BookingStatus;
  totalPriceCents?: number;
  instructorNote?: string;
}): Promise<void> {
  seq += 1;
  await prisma.booking.create({
    data: {
      bookerId: args.bookerId,
      instructorId: args.instructorId,
      date: args.date,
      anchorTime: "09:00",
      duration: Duration.ONE_HOUR,
      language: DbLocale.en,
      status: args.status,
      totalPriceCents: args.totalPriceCents ?? 11000,
      instructorNote: args.instructorNote ?? null,
      instructorNoteSetAt: args.instructorNote ? new Date() : null,
      icsUid: `${ICS_UID_PREFIX}${Date.now()}-${seq}@example.test`,
      attendees: {
        create: {
          name: "F087 Pupil",
          birthDate: new Date("2010-01-01T00:00:00.000Z"),
          level: Level.BEGINNER,
        },
      },
    },
  });
}

test.afterAll(async () => {
  // Dependency-safe teardown keyed on the email prefix, not icsUid: a booking
  // FK-references both its booker and its instructor (onDelete: Restrict), so
  // every booking touching an f087- user must go before any of those users.
  // Deleting the user cascades its Instructor row + attendees cascade on the
  // booking delete.
  const f087User = { email: { startsWith: EMAIL_PREFIX } };
  await prisma.booking.deleteMany({
    where: { OR: [{ booker: f087User }, { instructor: { user: f087User } }] },
  });
  await prisma.accountCredit.deleteMany({ where: { user: f087User } });
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
  await prisma.$disconnect();
});

test("non-admin student is denied the student directory (404)", async ({ page }) => {
  test.setTimeout(60_000);
  await signUp(page, "F087 Student", uniqueEmail("student"));
  const res = await page.goto("/admin/students");
  expect(res?.status()).toBe(404);
});

test("admin browses the directory, opens a profile with cross-instructor notes, and search filters", async ({
  page,
}) => {
  test.setTimeout(120_000);

  // Two instructors so the notes timeline must attribute authors (multi-coach).
  const lara = await createInstructor("Lara Instructor");
  const javi = await createInstructor("Javi Instructor");

  const bookerEmail = uniqueEmail("booker");
  const bookerId = await createBookerUser("Riley Booker", bookerEmail);

  const noteLara = `F087 Lara — strong toeside ${Date.now()}`;
  const noteJavi = `F087 Javi — link the turns ${Date.now()}`;

  await createBooking({
    bookerId,
    instructorId: lara.id,
    date: utcMidnight(-30),
    status: BookingStatus.COMPLETED,
    totalPriceCents: 20000,
    instructorNote: noteLara,
  });
  await createBooking({
    bookerId,
    instructorId: javi.id,
    date: utcMidnight(-15),
    status: BookingStatus.COMPLETED,
    totalPriceCents: 11000,
    instructorNote: noteJavi,
  });
  await createBooking({
    bookerId,
    instructorId: javi.id,
    date: utcMidnight(20),
    status: BookingStatus.CONFIRMED,
  });
  await createBooking({
    bookerId,
    instructorId: lara.id,
    date: utcMidnight(-5),
    status: BookingStatus.CANCELLED_BY_USER,
  });

  await signUpAsAdmin(page);

  // Directory lists bookers; search narrows to this one.
  await page.goto("/admin/students");
  await expect(page.getByTestId("admin-students-list")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("admin-students-q").fill(bookerEmail);
  await page.getByTestId("admin-students-submit").click();
  await page.waitForURL(/\/admin\/students\?.*q=/);

  const rows = page.getByTestId("admin-student-row");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Riley Booker");
  await expect(rows.first().getByTestId("admin-student-link")).toHaveAttribute(
    "href",
    `/admin/students/${bookerId}`,
  );

  // Open the profile via the row link.
  await rows.first().getByTestId("admin-student-link").click();
  await page.waitForURL(/\/admin\/students\/[^/?]+$/);

  // Stats: 2 completed lessons; spend excludes cancelled (20000 + 11000 + 11000).
  await expect(page.getByTestId("admin-student-lessons")).toHaveText("2");
  await expect(page.getByTestId("admin-student-spend")).toContainText("420.00");

  // Notes timeline: both instructors' notes with attribution, newest first.
  const notes = page.getByTestId("admin-student-note");
  await expect(notes).toHaveCount(2);
  await expect(notes.nth(0)).toContainText(noteJavi);
  await expect(notes.nth(0)).toContainText("Javi Instructor");
  await expect(notes.nth(1)).toContainText(noteLara);
  await expect(notes.nth(1)).toContainText("Lara Instructor");

  // Bookings history shows every status (4 rows).
  await expect(page.getByTestId("admin-student-booking")).toHaveCount(4);

  // Interconnection: a booking row in the profile links to that booking's
  // detail page.
  await page
    .getByTestId("admin-student-booking")
    .first()
    .getByTestId("admin-student-booking-link")
    .click();
  await page.waitForURL(/\/admin\/bookings\/[^/?]+$/);
  await expect(page.getByTestId("admin-booking-detail-status")).toBeVisible({
    timeout: 15_000,
  });

  // Interconnection: the bookings list links the booker name back to the
  // student profile.
  await page.goto(`/admin/bookings?q=${encodeURIComponent(bookerEmail)}`);
  const bookerLink = page
    .getByTestId("admin-booking-row")
    .first()
    .getByTestId("admin-booking-booker-name");
  await expect(bookerLink).toHaveAttribute("href", `/admin/students/${bookerId}`);
  await bookerLink.click();
  await page.waitForURL(new RegExp(`/admin/students/${bookerId}$`));
  await expect(page.getByTestId("admin-student-contact")).toBeVisible({
    timeout: 15_000,
  });

  // A non-matching search yields the empty state.
  await page.goto("/admin/students?q=zzz-no-such-student-zzz");
  await expect(page.getByTestId("admin-students-empty")).toBeVisible();
});

test("internal instructor notes never reach the booker's dashboard", async ({ page }) => {
  test.setTimeout(90_000);

  // Fresh booker session (no admin), then inject a completed class with a note.
  const bookerEmail = uniqueEmail("dash");
  const bookerId = await signUp(page, "Dash Booker", bookerEmail);
  const inst = await createInstructor("Dash Instructor");

  const secretNote = `F087 internal — do not leak ${Date.now()}`;
  await createBooking({
    bookerId,
    instructorId: inst.id,
    date: utcMidnight(-10),
    status: BookingStatus.COMPLETED,
    instructorNote: secretNote,
  });

  await page.goto("/dashboard");
  await expect(page.locator("body")).not.toContainText(secretNote);
});
