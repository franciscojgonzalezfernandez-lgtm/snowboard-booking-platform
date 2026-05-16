import { test, expect } from "@playwright/test";

function uniqueEmail() {
  return `f005-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

test.describe("F-005 — Better Auth", () => {
  test("login page renders three auth methods", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-title")).toHaveText("Sign in");
    await expect(page.getByTestId("input-email")).toBeVisible();
    await expect(page.getByTestId("input-password")).toBeVisible();
    await expect(page.getByTestId("btn-google")).toBeVisible();
    await expect(page.getByTestId("btn-magic-link")).toBeVisible();
  });

  test("email+password signup creates a session getSession can read", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const password = "Sn0wb0ard!Strong";

    await page.goto("/login");
    await page.getByTestId("tab-signup").click();
    await page.getByTestId("input-name").fill("F005 Tester");
    await page.getByTestId("input-email").fill(email);
    await page.getByTestId("input-password").fill(password);
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

  test("email+password sign in works for an existing account", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const password = "Sn0wb0ard!Strong";

    await page.goto("/login");
    await page.getByTestId("tab-signup").click();
    await page.getByTestId("input-name").fill("F005 Returning");
    await page.getByTestId("input-email").fill(email);
    await page.getByTestId("input-password").fill(password);
    await page.getByTestId("submit-credentials").click();
    await page.waitForURL(/\/(en|de|es)\/?$/);

    await page.context().clearCookies();

    await page.goto("/login");
    await page.getByTestId("input-email").fill(email);
    await page.getByTestId("input-password").fill(password);
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
    await page.goto("/login");

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
    await page.goto("/login");
    await page.getByTestId("input-email").fill(uniqueEmail());
    await page.getByTestId("btn-magic-link").click();
    await expect(page.getByTestId("magic-sent")).toBeVisible({ timeout: 5000 });
  });
});
