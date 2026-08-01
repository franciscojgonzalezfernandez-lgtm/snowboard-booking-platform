import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireInstructor } from "@/lib/auth/require-instructor";
import { encryptToken, isCalendarCryptoConfigured } from "@/lib/calendar/crypto";
import {
  appBaseUrl,
  exchangeCodeForTokens,
  isGoogleOAuthConfigured,
} from "@/lib/calendar/google-oauth";
import { prisma } from "@/lib/db";

import { OAUTH_STATE_COOKIE } from "../connect/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OAuth redirect target: validate state, exchange the code for a refresh token,
// encrypt it, and persist the connection. Always lands back on the calendar
// page with a query flag the UI turns into a message.
export async function GET(request: Request): Promise<NextResponse> {
  const { instructorId } = await requireInstructor();
  const base = appBaseUrl();
  const back = (query: string) =>
    NextResponse.redirect(`${base}/instructor/calendar?${query}`);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (oauthError) return back("calendar_error=denied");
  if (!isGoogleOAuthConfigured() || !isCalendarCryptoConfigured()) {
    return back("calendar_error=not_configured");
  }
  // Anti-CSRF: the round-tripped state must match the cookie we set.
  if (!code || !state || !expectedState || state !== expectedState) {
    return back("calendar_error=state");
  }

  try {
    const { refreshToken } = await exchangeCodeForTokens(code);
    if (!refreshToken) {
      // No refresh_token means consent wasn't re-granted (prompt=consent forces
      // it, but a previously-authorised account may skip it). Ask Google to
      // revoke prior access, or disconnect+reconnect.
      return back("calendar_error=no_refresh_token");
    }
    await prisma.instructor.update({
      where: { id: instructorId },
      data: {
        googleRefreshToken: encryptToken(refreshToken),
        calendarConnected: true,
      },
    });
    return back("calendar_connected=1");
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: "calendar.oauth" } });
    return back("calendar_error=exchange");
  }
}
