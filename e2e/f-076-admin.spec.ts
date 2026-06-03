import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import { Locale as DbLocale, PrismaClient, Role } from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const EMAIL_PREFIX = "f076-";

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, name: string): Promise<string> {
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
  return user.id;
}

/** Sign up, promote to admin, and give them an Instructor profile so the admin
 * calendar has someone to manage. */
async function signUpAsAdmin(page: Page): Promise<{
  userId: string;
  instructorId: string;
}> {
  const userId = await signUp(page, "F076 Admin");
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.instructor, Role.admin] },
  });
  const instructor = await prisma.instructor.create({
    data: {
      userId,
      bio: "F076 admin-instructor",
      specialties: [],
      languages: [DbLocale.en],
    },
    select: { id: true },
  });
  return { userId, instructorId: instructor.id };
}

async function inSeasonDate(offsetDays = 0): Promise<Date> {
  const season = await prisma.season.findFirst({
    where: { active: true },
    select: { startDate: true, endDate: true },
  });
  if (!season) throw new Error("No active season seeded — cannot run F-076 e2e");
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
    throw new Error("Computed F-076 e2e date falls outside active season");
  }
  return base;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoMonth(d: Date): string {
  return d.toISOString().slice(0, 7);
}

test.afterAll(async () => {
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

test("non-admin is denied the admin area (404)", async ({ page }) => {
  test.setTimeout(60_000);
  await signUp(page, "F076 Student"); // student role only
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
});

test("admin lands on the calendar and can open then close a day", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { instructorId } = await signUpAsAdmin(page);
  const day = await inSeasonDate(0);
  const iso = isoDate(day);

  await page.goto(`/admin?instructor=${instructorId}&month=${isoMonth(day)}`);
  await expect(page.getByTestId("admin-calendar")).toBeVisible();

  const cell = page.getByTestId(`calendar-day-${iso}`);
  await expect(cell).toHaveAttribute("data-open", "false");
  await cell.click();

  await expect(page.getByTestId("day-panel")).toBeVisible();
  await page.getByTestId("open-day").click();

  // After the open + router refresh the day reads as open. A generous timeout
  // absorbs the server-action round-trip + RSC refetch (slow on first dev
  // compile of /admin).
  await expect(page.getByTestId(`calendar-day-${iso}`)).toHaveAttribute(
    "data-open",
    "true",
    { timeout: 15_000 },
  );

  // Close it again.
  await page.getByTestId(`calendar-day-${iso}`).click();
  await page.getByTestId("close-day").click();
  await expect(page.getByTestId(`calendar-day-${iso}`)).toHaveAttribute(
    "data-open",
    "false",
    { timeout: 15_000 },
  );
});

test("admin creates an instructor and it appears in the list", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await signUpAsAdmin(page);
  const email = uniqueEmail("created");

  await page.goto("/admin/instructors");
  await expect(page.getByTestId("instructor-create-form")).toBeVisible();

  await page.getByTestId("instructor-name").fill("Created Coach");
  await page.getByTestId("instructor-email").fill(email);
  await page.getByTestId("instructor-language-de").click();
  await page.getByTestId("instructor-specialties").fill("freestyle, powder");
  await page.getByTestId("instructor-bio").fill("Created via admin panel.");
  await page.getByTestId("instructor-create-submit").click();

  const list = page.getByTestId("admin-instructor-list");
  await expect(list).toContainText("Created Coach", { timeout: 15_000 });
  await expect(list).toContainText(email);

  // Persisted with the instructor role.
  const created = await prisma.user.findUnique({
    where: { email },
    select: { roles: true, instructor: { select: { id: true } } },
  });
  expect(created?.roles).toContain(Role.instructor);
  expect(created?.instructor).not.toBeNull();
});
