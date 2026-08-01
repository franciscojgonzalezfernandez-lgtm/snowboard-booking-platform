import { test, expect } from "@playwright/test";

/**
 * F-122 — Email verified before a slot can be held (booking-inventory DoS).
 *
 * `requireEmailVerification` is on, so an email+password account can no longer
 * hold a slot until it confirms its address. In the funnel that means a
 * new/unverified email now lands on a "confirm your email" panel with a resend
 * control, instead of flipping straight to the payment form (the F-119 on-page
 * behaviour, now superseded — see that spec's note). Google and magic link stay
 * exempt (both arrive pre-verified) and are not exercised here (they need real
 * OAuth / an inbox).
 *
 * The verify state is asserted without reading an inbox: it appears purely from
 * Better Auth returning EMAIL_NOT_VERIFIED on the follow-up sign-in, regardless
 * of whether the email actually sent (dev has no RESEND key → console no-op).
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
  return `f122-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

test.describe("F-122 — email verification gate in the funnel", () => {
  test("a new email+password lands on the confirm-your-email state, not payment", async ({
    page,
  }) => {
    await page.goto(step4Url());

    await page.getByTestId("step4-auth-email").fill(uniqueEmail());
    await page.getByTestId("step4-auth-password").fill("Sn0wb0ard!Strong");
    await page.getByTestId("step4-auth-submit").click();

    // Verify panel replaces the auth form; payment never mounts.
    await expect(page.getByTestId("step4-auth-verify")).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByTestId("step4-auth-verify-resend")).toBeVisible();
    await expect(page.getByTestId("section-4")).toHaveCount(0);
    // Still on the funnel URL — no navigation, draft preserved in the query.
    expect(new URL(page.url()).pathname).toBe("/en/reservar");
  });

  test("resend from the verify state confirms without leaving the funnel", async ({
    page,
  }) => {
    await page.goto(step4Url());

    await page.getByTestId("step4-auth-email").fill(uniqueEmail());
    await page.getByTestId("step4-auth-password").fill("Sn0wb0ard!Strong");
    await page.getByTestId("step4-auth-submit").click();

    await expect(page.getByTestId("step4-auth-verify")).toBeVisible({
      timeout: 20000,
    });

    await page.getByTestId("step4-auth-verify-resend").click();

    await expect(page.getByTestId("step4-auth-verify-resent")).toBeVisible();
    await expect(page.getByTestId("step4-auth-error")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/en/reservar");
  });
});
