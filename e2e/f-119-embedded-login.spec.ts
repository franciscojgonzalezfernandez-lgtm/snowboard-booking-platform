import { test, expect } from "@playwright/test";

/**
 * F-119 — Login embedded in the booking funnel (Section 4).
 *
 * The anonymous Section 4 used to link out to `/login?next=…`. It now embeds
 * the three auth methods in-page (Google + magic link + email/password) with
 * auto-provisioning and no sign-in/sign-up toggle. Email+password is the
 * fully on-page path: on success the RSC re-renders in place and Section 4
 * flips to the authenticated booker/payment form — no navigation.
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

function uniqueEmail(): string {
  return `f119-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
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

  test("email+password auto-provisions a new booker and flips Section 4 in-place", async ({
    page,
  }) => {
    await page.goto(step4Url());

    // No sign-up step: a brand-new email is created on submit.
    await page.getByTestId("step4-auth-email").fill(uniqueEmail());
    await page.getByTestId("step4-auth-password").fill("Sn0wb0ard!Strong");
    await page.getByTestId("step4-auth-submit").click();

    // Section 4 becomes the authenticated booker/payment form (data-testid
    // "section-4") without leaving /en/reservar.
    await expect(page.getByTestId("section-4")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("step4-auth")).toHaveCount(0);
    await expect(page.getByTestId("section-4-anonymous")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/en/reservar");
  });

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
