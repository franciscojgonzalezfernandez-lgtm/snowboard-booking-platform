import "server-only";

// Google Calendar OAuth: a *separate* flow from Better Auth login. Better Auth
// owns sign-in (login-only Google scopes); this flow asks for offline access to
// the instructor's calendar (`calendar.events`) and yields a long-lived refresh
// token we encrypt + persist. Implemented with plain fetch against Google's
// OAuth endpoints — no `googleapis` dependency (only two endpoints + a refresh).

export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Canonical app origin (prod domain / localhost), per BETTER_AUTH_URL. */
export function appBaseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

/** Must match a redirect URI registered on the OAuth client in Google Cloud. */
export function calendarRedirectUri(): string {
  return `${appBaseUrl()}/instructor/calendar/callback`;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_ID && process.env.GOOGLE_SECRET);
}

/**
 * Consent URL forcing a refresh token: `access_type=offline` + `prompt=consent`
 * (Google only re-issues a refresh_token when consent is re-granted).
 */
export function buildConsentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_ID!,
    redirect_uri: calendarRedirectUri(),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type TokenExchange = {
  refreshToken: string | null;
  accessToken: string;
  expiresInSeconds: number;
};

/** Exchange an authorization code for tokens (authorization_code grant). */
export async function exchangeCodeForTokens(code: string): Promise<TokenExchange> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_ID!,
      client_secret: process.env.GOOGLE_SECRET!,
      redirect_uri: calendarRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    refresh_token?: string;
    access_token: string;
    expires_in: number;
  };
  return {
    refreshToken: json.refresh_token ?? null,
    accessToken: json.access_token,
    expiresInSeconds: json.expires_in,
  };
}

/** Raised by {@link refreshAccessToken} when Google reports `invalid_grant`
 * (revoked / expired refresh token) — the caller disconnects the calendar. */
export class InvalidGrantError extends Error {
  constructor() {
    super("Google refresh token is no longer valid (invalid_grant)");
    this.name = "InvalidGrantError";
  }
}

/** Mint a short-lived access token from a refresh token (refresh_token grant). */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_ID!,
      client_secret: process.env.GOOGLE_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (res.status === 400) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (json.error === "invalid_grant") throw new InvalidGrantError();
  }
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${res.status}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}
