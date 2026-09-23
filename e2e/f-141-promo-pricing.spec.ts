import { test, expect, type Page } from "@playwright/test";
import { signUpVerified } from "./helpers/auth";
import { config as loadDotenv } from "dotenv";
import { PrismaClient, Role } from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

// The pricing editor mutates the *active* season's shared price/promo columns.
// Run serially and snapshot/restore so other specs (Step 5, credits, f-080) are
// unaffected. The promo-requires-banner block path is covered by the unit tests
// (lib/admin/pricing.test.ts) — asserting it here would mean disabling the
// shared seed banner, which races f-053 under fullyParallel.
test.describe.configure({ mode: "serial" });

const EMAIL_PREFIX = "f141-";

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUpAsAdmin(page: Page): Promise<string> {
  const email = uniqueEmail("admin");
  const userId = await signUpVerified(page, email, "F141 Admin");
  await prisma.user.update({
    where: { id: userId },
    data: { roles: [Role.student, Role.admin] },
  });
  return userId;
}

let activeSeasonId: string | null = null;
let originalPrices: unknown = null;
let originalPromoPrices: unknown = null;
let originalPromoLabels: unknown = null;

test.beforeAll(async () => {
  const season = await prisma.season.findFirst({
    where: { active: true },
    select: {
      id: true,
      priceCentsByDuration: true,
      promoPriceCentsByDuration: true,
      promoLabelByDuration: true,
    },
  });
  if (season) {
    activeSeasonId = season.id;
    originalPrices = season.priceCentsByDuration;
    originalPromoPrices = season.promoPriceCentsByDuration;
    originalPromoLabels = season.promoLabelByDuration;
  }
  // The save is blocked without an enabled banner; make sure one exists.
  const enabled = await prisma.adBanner.count({ where: { enabled: true } });
  if (enabled === 0) {
    await prisma.adBanner.updateMany({ data: { enabled: true } });
  }
});

test.afterAll(async () => {
  if (activeSeasonId) {
    await prisma.season.update({
      where: { id: activeSeasonId },
      data: {
        priceCentsByDuration: originalPrices as never,
        promoPriceCentsByDuration: (originalPromoPrices ?? null) as never,
        promoLabelByDuration: (originalPromoLabels ?? null) as never,
      },
    });
  }
  await prisma.$disconnect();
});

test.describe("F-141 promotional pricing", () => {
  test("admin sets a promo → it stores, and shows struck on home + pricing", async ({
    page,
  }) => {
    test.skip(!activeSeasonId, "no active season in the test database");
    await signUpAsAdmin(page);

    await page.goto("/admin/pricing");
    await expect(page.getByTestId("pricing-form")).toBeVisible();

    // Set a known regular price + a promo on the 1-hour tier.
    await page.getByTestId("price-ONE_HOUR").fill("120");
    await page.getByTestId("promo-price-ONE_HOUR").fill("95");

    // The three localized copy inputs are revealed once a promo price is typed.
    await expect(page.getByTestId("promo-labels-ONE_HOUR")).toBeVisible();
    await page.getByTestId("promo-label-ONE_HOUR-en").fill("E2E Season Open");
    await page.getByTestId("promo-label-ONE_HOUR-de").fill("E2E Saisonstart");
    await page.getByTestId("promo-label-ONE_HOUR-es").fill("E2E Apertura");

    await page.getByTestId("pricing-submit").click();

    // Saved: no error, the current-prices summary reflects the regular price.
    await expect(page.getByTestId("pricing-error")).toHaveCount(0);
    await expect(page.getByTestId("pricing-current-ONE_HOUR")).toContainText("120");

    // Source of truth: the promo cents are persisted on the active season.
    const season = await prisma.season.findUnique({
      where: { id: activeSeasonId! },
      select: { promoPriceCentsByDuration: true },
    });
    expect(season?.promoPriceCentsByDuration).toMatchObject({ ONE_HOUR: 9_500 });

    // Marketing pricing page: promo price + struck-through original + copy.
    await page.goto("/en/pricing");
    const pricingCard = page.getByTestId("pricing-price-ONE_HOUR");
    await expect(pricingCard).toContainText("95");
    await expect(pricingCard).toContainText("120");
    await expect(pricingCard.locator("s, .line-through")).toContainText("120");

    // Home tier card: same treatment (F-141 added prices to the home cards).
    await page.goto("/en");
    const homeCard = page.getByTestId("home-price-ONE_HOUR");
    await expect(homeCard).toContainText("95");
    await expect(homeCard).toContainText("120");
    await expect(homeCard).toContainText("E2E Season Open");
  });

  test("de locale shows the German promo copy", async ({ page }) => {
    test.skip(!activeSeasonId, "no active season in the test database");
    await page.goto("/de/preise");
    const card = page.getByTestId("pricing-price-ONE_HOUR");
    await expect(card).toContainText("95");
    await expect(card).toContainText("E2E Saisonstart");
  });
});
