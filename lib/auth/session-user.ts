import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/**
 * Resolve the signed-in user for booker-facing Server Actions (F-086e).
 * Returns null instead of redirecting — unlike requireAdmin /
 * requireInstructor, which guard whole pages — because actions must answer
 * `{ ok: false, error: "UNAUTHORIZED" }` so the client renders the error in
 * place instead of navigating away mid-interaction.
 *
 * F-122: `emailVerified` travels along so the booking-draft chokepoint can
 * refuse to hold a slot for an unverified account even if some auth path ever
 * leaves an unverified session behind (defense-in-depth behind
 * `requireEmailVerification`).
 */
export async function getSessionUser(): Promise<{
  id: string;
  emailVerified: boolean;
} | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user
    ? { id: session.user.id, emailVerified: session.user.emailVerified }
    : null;
}
