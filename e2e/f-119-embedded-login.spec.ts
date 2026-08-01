import { test, expect } from "@playwright/test";

/**
 * F-119 — Login embedded in the booking funnel (Section 4).
 *
 * The anonymous Section 4 used to link out to `/login?next=…`. It now embeds
 * the three auth methods in-page (Google + magic link + email/password) with
 * auto-provisioning and no sign-in/sign-up toggle.
 *
 * F-122 changed the email+password contract: with `requireEmailVerification`
 * on, that path is no longer fully on-page — a new/unverified email now lands on
 * a "confirm your email" state instead of flipping straight to payment. The
 * positive email+password behaviour lives in `e2e/f-122-email-verification.spec.ts`;
 * this spec only guards what F-119 still owns: the three methods are embedded
 * in-page with no link-out, and magic link validates inline.
 *
 * Seeded deep-link (matches the other funnel specs): a ONE_HOUR lesson on
 * 2026-12-15 at 10:00 with the owner instructor, which reveals Section 4.
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

test.describe("F-119 — embedded Section 4 auth", () => {
  test("anonymous Section 4 embeds the three methods and links out nowhere", async ({
    page,
  }) => {
    await page.goto(step4Url());

    await expect(page.getByTestId("step4-auth")).toBeVisible();
    await expect(page.getByTestId("step4-auth-google")).toBeVisible();
    await expect(page.getByTestId("step4-auth-email")).toBeVisible();
    await expect(page.getByTestId("step4-auth-password")).toBeVisible();
    await expect(page.getByTestId("step4-auth-magic")).toBeVisible();

    // The old link-out to /login is gone and nothing navigated.
    await expect(page.getByTestId("step4-anonymous-cta")).toHaveCount(0);
    await expect(page.locator('a[href*="/login"]')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/en/reservar");
  });

  // The email+password positive path (new email → "confirm your email", not
  // payment) moved to e2e/f-122-email-verification.spec.ts when F-122 turned on
  // `requireEmailVerification`.

  test("magic link validates the email inline instead of leaving the funnel", async ({
    page,
  }) => {
    await page.goto(step4Url());

    // Clicking magic link with an empty email surfaces a client-side field
    // error and never navigates — the funnel URL is untouched.
    await page.getByTestId("step4-auth-magic").click();

    await expect(page.getByTestId("step4-auth")).toBeVisible();
    await expect(page.getByText("Enter a valid email first")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/en/reservar");
  });
});
