import type { Page } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import { PrismaClient } from "@prisma/client";

// Playwright runs with NODE_ENV=test; Next's loadEnvConfig skips .env.local.
// Load it explicitly so this helper writes to the dev Neon branch, same as the
// specs that consume it.
loadDotenv({ path: ".env.local", override: true });
loadDotenv({ path: ".env" });

const prisma = new PrismaClient();

const E2E_PASSWORD = "Sn0wb0ard!Strong";

/**
 * F-128: create a signed-in booker under `requireEmailVerification` (F-122).
 *
 * A plain email+password sign-up no longer yields a session — the address must
 * be verified first. Every authenticated spec used to sign up through the login
 * form and `waitForURL` home; that redirect never happens now, so they hung to a
 * 30s timeout. This helper reproduces a *verified* session deterministically:
 *
 *   1. create the account via the API (no session),
 *   2. flip `emailVerified` in the DB — the test-suite shortcut for the inbox
 *      round-trip, exactly what F-122's back-fill migration does for real payers,
 *   3. sign in via the API, which lands the session cookie on the page's shared
 *      cookie jar so subsequent `page.goto` is authenticated.
 *
 * `page.request` shares cookie storage with the browser context, so no manual
 * cookie plumbing is needed. Returns the created user id for specs that go on to
 * promote roles or seed bookings.
 */
export async function signUpVerified(
  page: Page,
  email: string,
  name = "E2E Tester",
): Promise<string> {
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password: E2E_PASSWORD, name },
  });
  if (!res.ok()) {
    // Fail loud with the real cause (e.g. a 429 from the rate limiter on a
    // production build — the test server should set AUTH_RATE_LIMIT_DISABLED)
    // instead of the cryptic "record not found" from the update below.
    throw new Error(
      `sign-up failed (${res.status()}) for ${email}: ${await res.text()}`,
    );
  }
  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
    select: { id: true },
  });
  await page.request.post("/api/auth/sign-in/email", {
    data: { email, password: E2E_PASSWORD },
  });
  return user.id;
}
