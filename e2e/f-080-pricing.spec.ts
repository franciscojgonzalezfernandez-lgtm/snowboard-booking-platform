import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import { PrismaClient, Role } from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const EMAIL_PREFIX = "f080-";

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

async function signUpAsAdmin(page: Page): Promise<{ userId: string; email: string }> {
  const { userId, email } = await signUp(page, "F080 Admin");
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.admin] },
  });
  return { userId, email };
}

// The pricing editor mutates the *active* season's shared price map. Snapshot it
// before the suite and restore after, so other specs that assert specific
// charge amounts (Step 5, credits) are unaffected.
let activeSeasonId: string | null = null;
let originalPrices: unknown = null;

test.beforeAll(async () => {
  const season = await prisma.season.findFirst({
    where: { active: true },
    select: { id: true, priceCentsByDuration: true },
  });
  if (season) {
    activeSeasonId = season.id;
    originalPrices = season.priceCentsByDuration;
  }
});

test.afterAll(async () => {
  if (activeSeasonId) {
    await prisma.season.update({
      where: { id: activeSeasonId },
      data: { priceCentsByDuration: originalPrices as never },
    });
  }
  await prisma.$disconnect();
});

test.describe("F-080 pricing editor", () => {
  test("non-admin gets 404 on /admin/pricing", async ({ page }) => {
    await signUp(page, "F080 Student");
    const res = await page.goto("/admin/pricing");
    expect(res?.status()).toBe(404);
  });

  test("admin edits a price → persists cents + reflects on the page", async ({ page }) => {
    test.skip(!activeSeasonId, "no active season in the test database");
    await signUpAsAdmin(page);

    await page.goto("/admin/pricing");
    await expect(page.getByTestId("pricing-form")).toBeVisible();

    // New whole-franc prices (avoid sub-cent rounding noise in assertions).
    const next = { ONE_HOUR: 125, TWO_HOURS: 225, INTENSIVE: 410, FULL_DAY: 560 };
    await page.getByTestId("price-ONE_HOUR").fill(String(next.ONE_HOUR));
    await page.getByTestId("price-TWO_HOURS").fill(String(next.TWO_HOURS));
    await page.getByTestId("price-INTENSIVE").fill(String(next.INTENSIVE));
    await page.getByTestId("price-FULL_DAY").fill(String(next.FULL_DAY));

    await page.getByTestId("pricing-submit").click();

    // Current-prices summary re-renders with the new amount after revalidation.
    await expect(page.getByTestId("pricing-current-ONE_HOUR")).toContainText("125");

    // Source of truth: the active season stores the new integer cents. Step 1
    // reads this exact row via the same getPriceCents, so a correct store here
    // is a correct funnel price.
    const season = await prisma.season.findUnique({
      where: { id: activeSeasonId! },
      select: { priceCentsByDuration: true },
    });
    expect(season?.priceCentsByDuration).toMatchObject({
      ONE_HOUR: 12_500,
      TWO_HOURS: 22_500,
      INTENSIVE: 41_000,
      FULL_DAY: 56_000,
    });
  });

  test("rejects a zero price (client validation blocks submit)", async ({ page }) => {
    test.skip(!activeSeasonId, "no active season in the test database");
    await signUpAsAdmin(page);

    await page.goto("/admin/pricing");
    await page.getByTestId("price-ONE_HOUR").fill("0");
    await page.getByTestId("pricing-submit").click();

    // Invalid → field-level error shown, no toast success navigation.
    await expect(page.getByTestId("price-ONE_HOUR")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
