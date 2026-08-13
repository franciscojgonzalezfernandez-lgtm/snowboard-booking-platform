import { test, expect } from "@playwright/test";
import { signUpVerified } from "./helpers/auth";

function uniqueEmail() {
  return `f005-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

test.describe("F-005 — Better Auth", () => {
  test("login page renders three auth methods", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.getByTestId("login-title")).toHaveText("Sign in");
    await expect(page.getByTestId("input-email")).toBeVisible();
    await expect(page.getByTestId("input-password")).toBeVisible();
    await expect(page.getByTestId("btn-google")).toBeVisible();
    await expect(page.getByTestId("btn-magic-link")).toBeVisible();
  });

  for (const locale of ["de", "es"] as const) {
    test(`/${locale}/login also renders the three auth methods`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/login`);
      await expect(page.getByTestId("input-email")).toBeVisible();
      await expect(page.getByTestId("input-password")).toBeVisible();
      await expect(page.getByTestId("btn-google")).toBeVisible();
      await expect(page.getByTestId("btn-magic-link")).toBeVisible();
    });
  }

  // F-122/F-128: sign-up now requires email verification, so it creates no
  // session — the form swaps to the confirm-your-email panel instead of
  // redirecting home. (The old "signup creates a session" contract is gone.)
  test("email+password signup shows the confirm-email state and creates no session", async ({
    page,
  }) => {
    const email = uniqueEmail();

    await page.goto("/en/login");
    await page.getByTestId("tab-signup").click();
    await page.getByTestId("input-name").fill("F005 Tester");
    await page.getByTestId("input-email").fill(email);
    await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
    await page.getByTestId("submit-credentials").click();

    await expect(page.getByTestId("login-verify")).toBeVisible();

    const session = await page.evaluate(async () => {
      const res = await fetch("/api/auth/get-session", {
        credentials: "include",
      });
      return res.ok ? await res.json() : null;
    });
    expect(session?.user ?? null).toBeNull();
  });

  test("a verified email+password account signs in through the form", async ({
    page,
  }) => {
    const email = uniqueEmail();

    // Seed a verified account (API create + verify + sign-in), then drop the
    // session so we exercise the form's sign-in path for a verified user.
    await signUpVerified(page, email, "F005 Returning");
    await page.context().clearCookies();

    await page.goto("/en/login");
    await page.getByTestId("input-email").fill(email);
    await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
    await page.getByTestId("submit-credentials").click();
    await page.waitForURL(/\/(en|de|es)\/?$/);

    const session = await page.evaluate(async () => {
      const res = await fetch("/api/auth/get-session", {
        credentials: "include",
      });
      return res.ok ? await res.json() : null;
    });
    expect(session?.user?.email).toBe(email);
  });

  test("Google button posts to the social sign-in endpoint", async ({
    page,
  }) => {
    await page.goto("/en/login");

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) =>
          req.url().includes("/api/auth/sign-in/social") &&
          req.method() === "POST",
        { timeout: 5000 },
      ),
      page.getByTestId("btn-google").click(),
    ]);

    const body = request.postDataJSON?.() ?? null;
    expect(body?.provider).toBe("google");
  });

  test("magic link button surfaces the stub confirmation", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByTestId("input-email").fill(uniqueEmail());
    await page.getByTestId("btn-magic-link").click();
    await expect(page.getByTestId("magic-sent")).toBeVisible({ timeout: 5000 });
  });
});
