import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireInstructor } from "@/lib/auth/require-instructor";
import { isCalendarCryptoConfigured } from "@/lib/calendar/crypto";
import {
  appBaseUrl,
  buildConsentUrl,
  isGoogleOAuthConfigured,
} from "@/lib/calendar/google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OAUTH_STATE_COOKIE = "gcal_oauth_state";

// Starts the Google Calendar OAuth consent. Anti-CSRF state is stored in an
// httpOnly cookie scoped to the callback path and compared on return.
export async function GET(): Promise<NextResponse> {
  await requireInstructor();

  const base = appBaseUrl();
  if (!isGoogleOAuthConfigured() || !isCalendarCryptoConfigured()) {
    // Fail soft when the feature is unprovisioned (no GOOGLE_* / ENCRYPTION_KEY).
    return NextResponse.redirect(
      `${base}/instructor/calendar?calendar_error=not_configured`,
    );
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: base.startsWith("https://"),
    sameSite: "lax",
    path: "/instructor/calendar",
    maxAge: 600,
  });

  return NextResponse.redirect(buildConsentUrl(state));
}
