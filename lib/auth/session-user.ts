import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/**
 * Resolve the signed-in user for booker-facing Server Actions (F-086e).
 * Returns null instead of redirecting — unlike requireAdmin /
 * requireInstructor, which guard whole pages — because actions must answer
 * `{ ok: false, error: "UNAUTHORIZED" }` so the client renders the error in
 * place instead of navigating away mid-interaction.
 */
export async function getSessionUser(): Promise<{ id: string } | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ? { id: session.user.id } : null;
}
