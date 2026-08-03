import { test, expect } from "@playwright/test";

// F-125 — the home was shipping 410 KB gz of First Load JS against a 200 KB
// budget. The fix moved four things off the critical path: the Sentry SDK
// (idle), the Better Auth session read (idle), and the two nav popups
// (interaction). These tests guard the *mechanism* — that the chunks really do
// arrive later, and that the UI they power still works when they do. The size
// number itself is guarded by `scripts/check-bundle-budget.mjs`.

const MOBILE = { width: 390, height: 844 };

test.describe("F-125 — JS arrives off the critical path", () => {
  test("mobile menu chunk is fetched on interaction, not on load", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);

    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(request.url());
    });

    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    const onLoad = scripts.length;

    // The trigger itself must be in the first paint — it is the only nav
    // affordance on mobile, so deferring it would be a regression, not a win.
    const trigger = page.getByTestId("mobile-nav-trigger");
    await expect(trigger).toBeVisible();

    await trigger.click();
    await expect(page.getByTestId("mobile-nav-sheet")).toBeVisible();

    expect(
      scripts.length,
      "tapping the menu should pull a chunk that page load did not",
    ).toBeGreaterThan(onLoad);
  });

  test("mobile menu still navigates and shows the signed-out CTA", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/en");

    await page.getByTestId("mobile-nav-trigger").click();
    await expect(page.getByTestId("mobile-nav-signin")).toBeVisible();

    await page.getByTestId("mobile-nav-plan").click();
    await expect(page).toHaveURL(/\/en\/plan-your-visit$/);
  });

  test("mobile menu returns focus to its trigger on close", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/en");

    const trigger = page.getByTestId("mobile-nav-trigger");
    await trigger.click();
    await expect(page.getByTestId("mobile-nav-sheet")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("mobile-nav-sheet")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("desktop More menu opens on click and closes on Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en");

    const more = page.getByTestId("site-nav-more");
    await expect(more).toHaveAttribute("aria-expanded", "false");

    await more.click();
    await expect(page.getByTestId("site-nav-plan")).toBeVisible();
    await expect(page.getByTestId("site-nav-about")).toBeVisible();
    await expect(more).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("site-nav-plan")).toBeHidden();
    await expect(more).toBeFocused();
  });

  test("anonymous auth CTA is present before the session chunk loads", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en", { waitUntil: "domcontentloaded" });

    // Rendered by AuthNavLinks, which carries no Better Auth import — so it is
    // on screen whether or not the session island has loaded yet.
    await expect(page.getByTestId("site-nav-signin")).toBeVisible();
  });
});
