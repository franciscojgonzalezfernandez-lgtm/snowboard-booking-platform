import { test, expect, type Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import { PrismaClient, Role } from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const EMAIL_PREFIX = "f088-";
const SEASON_PREFIX = "F088 ";

const COMPLETE_PRICING = {
  ONE_HOUR: 11_000,
  TWO_HOURS: 20_000,
  INTENSIVE: 38_500,
  FULL_DAY: 50_000,
};

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, name: string): Promise<{ userId: string }> {
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
  return { userId: user.id };
}

async function signUpAsAdmin(page: Page): Promise<void> {
  const { userId } = await signUp(page, "F088 Admin");
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.admin] },
  });
}

let seq = 0;
async function makeSeason(opts: {
  active?: boolean;
  pricing?: unknown;
}): Promise<string> {
  seq += 1;
  // Far-future dates so a transiently-active test season never collides with
  // real bookings/availability before afterAll restores the original.
  const year = 2040 + seq;
  const created = await prisma.season.create({
    data: {
      name: `${SEASON_PREFIX}${year}`,
      startDate: new Date(`${year}-12-01T00:00:00.000Z`),
      endDate: new Date(`${year + 1}-03-31T00:00:00.000Z`),
      anchorTimes: ["09:00", "11:00", "13:00"],
      operatingHoursStart: "09:00",
      operatingHoursEnd: "16:00",
      priceCentsByDuration: (opts.pricing ?? {}) as never,
      active: opts.active ?? false,
    },
    select: { id: true },
  });
  return created.id;
}

let originalActiveId: string | null = null;

test.beforeAll(async () => {
  const season = await prisma.season.findFirst({
    where: { active: true },
    select: { id: true },
  });
  originalActiveId = season?.id ?? null;
});

test.afterAll(async () => {
  // Remove test seasons, then restore the original active season so other
  // specs (Step 5, credits) see the seeded 26/27 prices again.
  await prisma.season.deleteMany({ where: { name: { startsWith: SEASON_PREFIX } } });
  if (originalActiveId) {
    await prisma.season.updateMany({
      where: { id: { not: originalActiveId } },
      data: { active: false },
    });
    await prisma.season.update({
      where: { id: originalActiveId },
      data: { active: true },
    });
  }
  await prisma.$disconnect();
});

test.describe.configure({ mode: "serial" });

test.describe("F-088 season management", () => {
  test("non-admin gets 404 on /admin/seasons", async ({ page }) => {
    await signUp(page, "F088 Student");
    const res = await page.goto("/admin/seasons");
    expect(res?.status()).toBe(404);
  });

  test("admin creates a season → it appears in the list", async ({ page }) => {
    await signUpAsAdmin(page);
    await page.goto("/admin/seasons");

    await page.getByTestId("season-new").click();
    await expect(page.getByTestId("season-create-dialog")).toBeVisible();

    const name = `${SEASON_PREFIX}created-${Date.now()}`;
    await page.getByTestId("season-name").fill(name);
    await page.getByTestId("season-start").fill("2041-12-01");
    await page.getByTestId("season-end").fill("2042-03-31");
    await page.getByTestId("season-anchors").fill("09:00, 11:00, 13:00");
    await page.getByTestId("season-ops-start").fill("09:00");
    await page.getByTestId("season-ops-end").fill("16:00");
    await page.getByTestId("season-submit").click();

    await expect(page.getByTestId("seasons-list")).toContainText(name);

    const inDb = await prisma.season.findFirst({ where: { name }, select: { active: true } });
    expect(inDb?.active).toBe(false); // created inactive
  });

  test("activating season B deactivates A (exactly one active)", async ({ page }) => {
    const aId = await makeSeason({ pricing: COMPLETE_PRICING });
    const bId = await makeSeason({ pricing: COMPLETE_PRICING });

    await signUpAsAdmin(page);
    await page.goto("/admin/seasons");

    // Activate A.
    await page.getByTestId(`season-activate-${aId}`).click();
    await page.getByTestId(`season-activate-confirm-${aId}`).click();
    await expect(page.getByTestId(`season-badge-active-${aId}`)).toBeVisible();

    // Activate B → A loses its badge.
    await page.getByTestId(`season-activate-${bId}`).click();
    await page.getByTestId(`season-activate-confirm-${bId}`).click();
    await expect(page.getByTestId(`season-badge-active-${bId}`)).toBeVisible();
    await expect(page.getByTestId(`season-badge-active-${aId}`)).toHaveCount(0);

    const activeCount = await prisma.season.count({ where: { active: true } });
    expect(activeCount).toBe(1);
    const a = await prisma.season.findUnique({ where: { id: aId }, select: { active: true } });
    expect(a?.active).toBe(false);
  });

  test("activating with incomplete pricing is blocked + hints to Pricing", async ({ page }) => {
    const id = await makeSeason({ pricing: {} }); // no prices

    await signUpAsAdmin(page);
    await page.goto("/admin/seasons");

    await page.getByTestId(`season-activate-${id}`).click();
    await expect(page.getByTestId(`season-activate-warning-${id}`)).toBeVisible();
    await page.getByTestId(`season-activate-confirm-${id}`).click();

    // Server rejects: the season stays inactive.
    await expect(page.getByTestId(`season-badge-active-${id}`)).toHaveCount(0);
    const inDb = await prisma.season.findUnique({ where: { id }, select: { active: true } });
    expect(inDb?.active).toBe(false);
  });

  test("with no active season, /admin/pricing shows the empty-state + CTA", async ({ page }) => {
    await signUpAsAdmin(page);
    // Deactivate everything.
    await prisma.season.updateMany({ data: { active: false } });

    await page.goto("/admin/pricing");
    await expect(page.getByTestId("pricing-no-season")).toBeVisible();
    const cta = page.getByTestId("pricing-manage-seasons");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/admin/seasons");
  });
});
