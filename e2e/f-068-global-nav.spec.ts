import { expect, test, type Page } from "@playwright/test";

const STRONG_PASSWORD = "Sn0wb0ard!Strong";

function uniqueEmail(tag: string): string {
  return `f068-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F068 Tester");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill(STRONG_PASSWORD);
  await page.getByTestId("submit-credentials").click();
  await page.waitForURL(/\/(en|de|es)\/?$/);
}

test.describe("F-068 SiteNav across chrome routes", () => {
  for (const path of [
    "/en",
    "/de",
    "/es",
    "/en/login",
    "/de/login",
    "/es/login",
    "/en/terms",
    "/de/terms",
    "/es/terms",
    "/en/privacy",
  ]) {
    test(`SiteNav is mounted on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByTestId("site-nav")).toBeVisible();
    });
  }

  test("SiteNav is NOT mounted on /reservar funnel", async ({ page }) => {
    await page.goto("/en/reservar");
    await expect(page.getByTestId("site-nav")).toHaveCount(0);
  });
});

test.describe("F-068 SiteNav auth variants", () => {
  test("anonymous sees Sign in, not Sign out", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByTestId("site-nav-signin").first()).toBeVisible();
    await expect(page.getByTestId("site-nav-signout")).toHaveCount(0);
  });

  test.describe.serial("signed-in flows", () => {
    test("signed-in user sees My account + Sign out on /dashboard", async ({
      page,
    }) => {
      const email = uniqueEmail("dash");
      await signUp(page, email);

      // /dashboard is always dynamic + auth-gated, so the nav reflects the
      // logged-in branch deterministically (no RSC route cache to go stale).
      await page.goto("/en/dashboard");
      await expect(page.getByTestId("site-nav")).toBeVisible();
      await expect(page.getByTestId("site-nav-account").first()).toBeVisible();
      await expect(page.getByTestId("site-nav-signout").first()).toBeVisible();
      await expect(page.getByTestId("site-nav-signin")).toHaveCount(0);
    });

    test("Sign out clears the session and re-gates /dashboard", async ({
      page,
    }) => {
      const email = uniqueEmail("signout");
      await signUp(page, email);

      await page.goto("/en/dashboard");
      await expect(page.getByTestId("site-nav-signout").first()).toBeVisible();

      // Sign out → server action clears the session and redirects to "/".
      // The nav flips to the anonymous branch (Sign in).
      await page.getByTestId("site-nav-signout").first().click();
      await expect(page.getByTestId("site-nav-signin").first()).toBeVisible();

      // Authoritative proof the session is gone: the auth-gated dashboard
      // redirects an anonymous visitor back to login with a next= param.
      await page.goto("/en/dashboard");
      await page.waitForURL(/\/en\/login\?next=/);
    });
  });
});
