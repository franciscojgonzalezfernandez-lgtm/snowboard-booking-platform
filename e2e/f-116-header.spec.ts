import { expect, test, type Page } from "@playwright/test";

// F-116 — desktop header rework. The owner reported the brand row crowding at
// ~1024–1280px: the "Ride Flumserberg" wordmark wrapped to two lines and the
// links + phone + language switcher + auth CTA all competed in one flex row.
// New IA: a top utility bar owns phone + language; the brand row keeps 3
// primary links + a "More" dropdown (About · Contact). These tests lock the
// layout invariants across the desktop widths and both auth states.

const DESKTOP_WIDTHS = [1024, 1280, 1440] as const;
const STRONG_PASSWORD = "Sn0wb0ard!Strong";

function uniqueEmail(tag: string): string {
  return `f116-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F116 Tester");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(STRONG_PASSWORD);
  await page.getByTestId("submit-credentials").click();
  await page.waitForURL(/\/(en|de|es)\/?$/);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflows, "page must not scroll horizontally").toBe(false);
}

async function expectWordmarkSingleLine(page: Page): Promise<void> {
  const box = await page.getByTestId("site-nav-brand").boundingBox();
  expect(box).not.toBeNull();
  // At 22px display type a single line is ~26–32px tall; a two-line wrap
  // doubles it. 40px cleanly separates the two.
  expect(box!.height, "wordmark must stay on one line").toBeLessThan(40);
}

test.describe("F-116 — desktop header layout (signed-out)", () => {
  for (const width of DESKTOP_WIDTHS) {
    test(`brand row is uncluttered at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/en");

      await expectWordmarkSingleLine(page);
      await expectNoHorizontalOverflow(page);

      // Utility bar owns phone + language switcher.
      await expect(page.getByTestId("site-nav-phone")).toBeVisible();
      await expect(page.getByTestId("lang-en")).toBeVisible();

      // Brand row keeps the primary links (Prices · Instructors · Field notes ·
      // Contact) + the More trigger + the auth CTA.
      const nav = page.getByTestId("site-nav");
      await expect(nav.locator('a[href="/en/pricing"]')).toBeVisible();
      await expect(nav.locator('a[href="/en/instructors"]')).toBeVisible();
      await expect(nav.locator('a[href="/en/blog"]')).toBeVisible();
      await expect(page.getByTestId("site-nav-contact")).toBeVisible();
      await expect(page.getByTestId("site-nav-more")).toBeVisible();
      await expect(page.getByTestId("site-nav-signin")).toBeVisible();

      // About is not a loose link in the row — only behind "More".
      await expect(nav.locator('a[href="/en/about"]')).toHaveCount(0);
    });
  }

  test('"More" dropdown reveals Plan your visit + About and toggles closed', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/en");

    const plan = page.getByTestId("site-nav-plan");
    const about = page.getByTestId("site-nav-about");
    await expect(about).toHaveCount(0); // closed by default

    await page.getByTestId("site-nav-more").click();
    // "More" group = Plan your visit + About only (Contact is a direct brand-row
    // link, not in the dropdown).
    await expect(plan).toBeVisible();
    await expect(plan).toHaveAttribute("href", "/en/plan-your-visit");
    await expect(about).toBeVisible();
    await expect(about).toHaveAttribute("href", "/en/about");

    await page.keyboard.press("Escape");
    await expect(about).toHaveCount(0);

    // And it navigates.
    await page.getByTestId("site-nav-more").click();
    await page.getByTestId("site-nav-about").click();
    await page.waitForURL(/\/en\/about$/);
  });
});

test.describe("F-116 — signed-in worst case", () => {
  test("account + sign out fit without breaking the brand row at 1024px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await signUp(page, uniqueEmail("signedin"));

    // /dashboard is auth-gated + always dynamic → the nav renders the
    // signed-in branch deterministically (both CTAs present).
    await page.goto("/en/dashboard");
    await expect(page.getByTestId("site-nav-account").first()).toBeVisible();
    await expect(page.getByTestId("site-nav-signout").first()).toBeVisible();

    await expectWordmarkSingleLine(page);
    await expectNoHorizontalOverflow(page);
  });
});
