import { test, expect } from "@playwright/test";

/**
 * F-134 — the callbackURL handed to Better Auth must not contain `:`.
 *
 * Better Auth's origin check rejects any callbackURL with a colon in it (it
 * reads it as a URL scheme — the open-redirect defence we want to keep). The
 * funnel carries the chosen start time as `t=09:00`, so every magic link sent
 * from Step 4 came back `403 INVALID_CALLBACK_URL`. Step 4 is only reachable
 * once a time is picked, so that was every real booking.
 *
 * Same seeded deep-link the other funnel specs use: a ONE_HOUR lesson on
 * 2026-12-15 at 10:00 with the owner instructor reveals Section 4.
 */

const STEP4 = {
  d: "ONE_HOUR",
  dt: "2026-12-15",
  t: "10:00",
  i: "instr_javi",
  l: "en",
} as const;

function step4Url(): string {
  return `/en/reservar?${new URLSearchParams(STEP4).toString()}`;
}

test.describe("F-134 — auth callbackURL survives the time param", () => {
  test("magic link request sends a colon-free callbackURL", async ({
    page,
  }) => {
    let callbackURL: string | undefined;

    // Intercept rather than let it through: this asserts the payload without
    // sending a real email or burning the rate limit.
    await page.route("**/api/auth/sign-in/magic-link", async (route) => {
      callbackURL = route.request().postDataJSON()?.callbackURL;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: true }),
      });
    });

    await page.goto(step4Url());
    await page.getByTestId("step4-auth-email").fill("f134@example.test");
    await page.getByTestId("step4-auth-magic").click();

    await expect
      .poll(() => callbackURL, { message: "magic link was never requested" })
      .toBeDefined();

    // The assertion that would have caught this in review.
    expect(callbackURL).not.toContain(":");
    expect(callbackURL).not.toContain("%3A");
    expect(callbackURL).toMatch(/^\/en\/reservar\?r=[A-Za-z0-9_-]+$/u);
  });

  test("returning on the packed URL restores the selection and cleans up", async ({
    page,
  }) => {
    let callbackURL: string | undefined;
    await page.route("**/api/auth/sign-in/magic-link", async (route) => {
      callbackURL = route.request().postDataJSON()?.callbackURL;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: true }),
      });
    });

    await page.goto(step4Url());
    await page.getByTestId("step4-auth-email").fill("f134@example.test");
    await page.getByTestId("step4-auth-magic").click();
    await expect.poll(() => callbackURL).toBeDefined();

    // Follow the packed URL the way the emailed link eventually would.
    await page.goto(callbackURL!);

    // Lands on the plain funnel URL — `r` is gone, the selection is back, and
    // Section 4 is showing, which only happens when all four are restored.
    await expect(page).toHaveURL(
      /\/en\/reservar\?d=ONE_HOUR&dt=2026-12-15&t=10%3A00&i=instr_javi&l=en$/u,
    );
    await expect(page.getByTestId("step4-auth")).toBeVisible();
  });

  test("Google sign-in gets the same colon-free callbackURL", async ({
    page,
  }) => {
    // The ticket left this open: `signIn.social` receives the same prop, so it
    // should be fixed by construction — but "should be" is not "is".
    let callbackURL: string | undefined;

    await page.route("**/api/auth/sign-in/social", async (route) => {
      callbackURL = route.request().postDataJSON()?.callbackURL;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ redirect: false, url: null }),
      });
    });

    await page.goto(step4Url());
    await page.getByTestId("step4-auth-google").click();

    await expect
      .poll(() => callbackURL, { message: "social sign-in was never requested" })
      .toBeDefined();

    expect(callbackURL).not.toContain(":");
    expect(callbackURL).not.toContain("%3A");
  });

  test("a tampered payload drops the state instead of injecting it", async ({
    page,
  }) => {
    const tampered = Buffer.from(
      JSON.stringify({ d: "FULL_DAY", redirect: "https://evil.test" }),
    )
      .toString("base64")
      .replace(/\+/gu, "-")
      .replace(/\//gu, "_")
      .replace(/=+$/u, "");

    await page.goto(`/en/reservar?r=${tampered}`);

    // The unknown key is stripped; only the valid duration survives, and we are
    // still on our own origin.
    await expect(page).toHaveURL(/\/en\/reservar\?d=FULL_DAY$/u);
    await expect(page.getByTestId("duration-picker")).toBeVisible();
  });

  test("junk in `r` degrades to the bare funnel", async ({ page }) => {
    await page.goto("/en/reservar?r=!!!not-base64!!!");

    await expect(page.getByTestId("duration-picker")).toBeVisible();
    expect(page.url()).toContain("/en/reservar");
  });
});
