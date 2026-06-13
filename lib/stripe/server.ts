import "server-only";

import Stripe from "stripe";

/**
 * Stripe SDK pinned API version. Bumping it is a deliberate act — Stripe's
 * dashboard exposes a different "default" per account, so pinning here makes
 * the server behavior reproducible across machines and environments. Match
 * this string when registering webhook endpoints in the dashboard.
 */
export const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

let cached: Stripe | null = null;

/**
 * Lazy singleton. We do not throw at module-load time so test files that
 * import this module (with mocked downstream behavior) can run without
 * setting `STRIPE_SECRET_KEY`. Real callers — route handlers, server actions
 * — invoke this and surface a clear error if the env is missing.
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — copy it from the Stripe dashboard (test mode) into .env and Vercel envs.",
    );
  }
  cached = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    appInfo: {
      name: "snowboard-booking-platform",
      version: "0.1.0",
      url: "https://rideflumserberg.ch",
    },
  });
  return cached;
}
