import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import { Locale as DbLocale, PrismaClient, Role } from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const EMAIL_PREFIX = "f074-";

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUpAsInstructor(page: Page): Promise<{ instructorId: string }> {
  // Better Auth sign-up against the Neon `dev` branch occasionally 500s on a
  // cold serverless connection; retry with a fresh email so the transient
  // infra flake doesn't fail the F-074 wiring under test.
  let email = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    email = uniqueEmail("instr");
    await page.goto("/en/login");
    await page.getByTestId("tab-signup").click();
    await page.getByTestId("input-name").fill("F074 Tester");
    await page.getByTestId("input-email").fill(email);
    await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
    await page.getByTestId("submit-credentials").click();
    try {
      await page.waitForURL(/\/(en|de|es)\/?$/, { timeout: 20_000 });
      break;
    } catch {
      if (attempt === 3) throw new Error(`Sign-up did not complete: ${email}`);
    }
  }

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
    data: { userId: user.id, specialties: [], languages: [DbLocale.en] },
    select: { id: true },
  });
  return { instructorId: instructor.id };
}

test.afterAll(async () => {
  await prisma.instructor.deleteMany({
    where: { user: { email: { startsWith: EMAIL_PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
  await prisma.$disconnect();
});

test("connect route redirects to Google consent with offline calendar scope", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await signUpAsInstructor(page);

  // Don't follow the redirect to Google — just assert where it points.
  const res = await page
    .context()
    .request.get("/instructor/calendar/connect", { maxRedirects: 0 });
  expect(res.status()).toBe(307);

  const location = res.headers()["location"] ?? "";
  expect(location).toContain("accounts.google.com");
  const url = new URL(location);
  expect(url.searchParams.get("scope")).toBe(
    "https://www.googleapis.com/auth/calendar.events",
  );
  expect(url.searchParams.get("access_type")).toBe("offline");
  expect(url.searchParams.get("prompt")).toBe("consent");
  expect(url.searchParams.get("client_id")).toBeTruthy();
  expect(url.searchParams.get("state")).toBeTruthy();
  // Anti-CSRF state cookie was set.
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === "gcal_oauth_state")).toBe(true);
});

test("UI shows Connect when disconnected", async ({ page }) => {
  test.setTimeout(60_000);
  await signUpAsInstructor(page);
  await page.goto("/instructor/calendar");
  const section = page.getByTestId("calendar-connection");
  await expect(section).toHaveAttribute("data-connected", "false");
  await expect(page.getByTestId("calendar-connect")).toBeVisible();
});

test("disconnect clears the stored token and connection flag", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { instructorId } = await signUpAsInstructor(page);
  // Simulate an already-connected instructor.
  await prisma.instructor.update({
    where: { id: instructorId },
    data: { calendarConnected: true, googleRefreshToken: "encrypted-placeholder" },
  });

  await page.goto("/instructor/calendar");
  await expect(page.getByTestId("calendar-connection")).toHaveAttribute(
    "data-connected",
    "true",
  );
  await page.getByTestId("calendar-disconnect").click();

  await expect
    .poll(async () => {
      const row = await prisma.instructor.findUnique({
        where: { id: instructorId },
        select: { calendarConnected: true, googleRefreshToken: true },
      });
      return row?.calendarConnected === false && row?.googleRefreshToken === null;
    }, { timeout: 15_000 })
    .toBe(true);
});
