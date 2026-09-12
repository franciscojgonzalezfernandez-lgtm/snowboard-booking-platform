import { test, expect, type Page } from "@playwright/test";
import { signUpVerified } from "./helpers/auth";
import { config as loadDotenv } from "dotenv";
import { PrismaClient, Role } from "@prisma/client";

loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const EMAIL_PREFIX = "f144-";

function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUpAsAdmin(page: Page): Promise<void> {
  const email = uniqueEmail("admin");
  await signUpVerified(page, email, "F144 Admin");
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) throw new Error(`User not found after signup: ${email}`);
  await prisma.user.update({
    where: { id: user.id },
    data: { roles: [Role.student, Role.admin] },
  });
}

// The editor mutates the *active* season's shared price map. Snapshot before
// and restore after, so specs that assert specific charge amounts (Step 5,
// credits, /precios) are unaffected — same contract as F-080.
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

/**
 * F-144 — an owner price edit must clear the public price caches at once.
 *
 * `updateSeasonPricing` revalidated only `/admin/pricing` and the funnel; the
 * public `/precios` page (ISR, 1h) and the LocalBusiness JSON-LD `priceRange`
 * (an `unstable_cache`, 1h, on every marketing page via the layout) were never
 * busted, so a new price stayed hidden for up to an hour — a public mispricing.
 *
 * The fix adds `revalidatePath("/[locale]/precios", "page")` and a
 * `revalidateTag(SEASON_PRICE_RANGE_TAG)`. This warms the public caches with the
 * pre-edit price, edits, then asserts the new price is visible immediately.
 *
 * Only meaningful against a real build: `next dev` re-renders every request, so
 * neither the ISR page nor the `unstable_cache` node is ever stale there and the
 * test would pass with or without the fix. It runs when the suite is pointed at
 * a build (PLAYWRIGHT_BASE_URL — a preview deployment, or a local
 * `next build && start`), where the warm GET is a cached response only a working
 * revalidate can replace — same split as F-124's cache-control assertions. The
 * build server must disable the auth rate limiter (AUTH_RATE_LIMIT_DISABLED) for
 * the admin sign-up, and set BETTER_AUTH_URL to its own origin.
 */
const againstBuild = !!process.env.PLAYWRIGHT_BASE_URL;

test.describe("F-144 — price edit clears the public caches", () => {
  test("new price shows on /precios and in the JSON-LD price range at once", async ({
    page,
  }) => {
    test.skip(
      !againstBuild,
      "cache staleness is only observable against a production build; set PLAYWRIGHT_BASE_URL",
    );
    test.skip(!activeSeasonId, "no active season in the test database");

    // Distinctive whole-franc prices — avoid sub-cent rounding noise, and pick a
    // new max (560) that differs from the seeded max so the JSON-LD range moves.
    const next = { ONE_HOUR: 117, TWO_HOURS: 225, INTENSIVE: 410, FULL_DAY: 560 };

    // 1. Sign in as admin *before* any navigation: `page.request` (used by the
    //    auth helper) only carries an Origin while the page is still blank, so
    //    Better Auth 403s a sign-up posted after a real `page.goto`.
    await signUpAsAdmin(page);

    // 2. Warm the public caches with the pre-edit price (see the mode note
    //    above). `/precios` is static (F-124) and never reads the session, so an
    //    authenticated GET hits the same shared ISR cache an anonymous one would.
    await page.goto("/es/precios");
    await expect(page.getByTestId("pricing-price-ONE_HOUR")).toBeVisible();

    // 3. Edit every duration via the admin editor.
    await page.goto("/admin/pricing");
    await expect(page.getByTestId("pricing-form")).toBeVisible();
    await page.getByTestId("price-ONE_HOUR").fill(String(next.ONE_HOUR));
    await page.getByTestId("price-TWO_HOURS").fill(String(next.TWO_HOURS));
    await page.getByTestId("price-INTENSIVE").fill(String(next.INTENSIVE));
    await page.getByTestId("price-FULL_DAY").fill(String(next.FULL_DAY));
    await page.getByTestId("pricing-submit").click();
    await expect(page.getByTestId("pricing-current-ONE_HOUR")).toContainText("117");

    // 4. Public pricing page reflects the new price immediately — not the stale
    //    cached one. Without the `/precios` revalidate this shows the old value
    //    against a build.
    await page.goto("/es/precios");
    await expect(page.getByTestId("pricing-price-ONE_HOUR")).toContainText("117");
    await expect(page.getByTestId("pricing-price-FULL_DAY")).toContainText("560");

    // 5. LocalBusiness JSON-LD `priceRange` (marketing layout, every page) too —
    //    the min–max must be the fresh 117–560, not the pre-edit range. Without
    //    the `revalidateTag`, this `unstable_cache` node stays stale.
    // (`hasText` can't filter <script> — its content isn't rendered text — so
    //  read every ld+json block and pick the LocalBusiness node by hand.)
    const ldBlocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const localBusiness = ldBlocks.find((block) => block.includes("priceRange"));
    expect(localBusiness, "LocalBusiness JSON-LD carries a priceRange").toBeDefined();
    expect(localBusiness).toContain("CHF 117");
    expect(localBusiness).toContain("560");
  });
});
