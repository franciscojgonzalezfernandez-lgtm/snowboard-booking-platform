import { Duration, Locale } from "@prisma/client";
import { z } from "zod";

/**
 * F-134 — packs the funnel's selection into a single colon-free parameter so it
 * can survive a trip through Better Auth.
 *
 * Better Auth validates every `callbackURL` with an origin check that rejects
 * anything containing `:` — it reads the colon as a URL scheme, which is
 * exactly the open-redirect defence we want to keep. But the funnel carries the
 * chosen start time in the query (`t=09:00`), and `URLSearchParams` encodes it
 * as `t=09%3A00`, so every magic link sent from Step 4 came back
 * `403 INVALID_CALLBACK_URL`. Step 4 is only reachable once a time is picked,
 * so that was every real booking, not an edge case.
 *
 * Rather than reshape the funnel's public URL (saved links, emails and the
 * funnel's own state contract all speak `t=HH:MM`), only the auth round-trip
 * uses this packed form. base64url is the point: its alphabet is
 * `A-Z a-z 0-9 - _`, so the result cannot contain a colon no matter what the
 * values are.
 */

const returnStateSchema = z.object({
  d: z.enum(Duration).optional(),
  dt: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/u)
    .optional(),
  t: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/u)
    .optional(),
  i: z.string().min(1).max(64).optional(),
  l: z.enum(Locale).optional(),
});

export type FunnelReturnState = z.infer<typeof returnStateSchema>;

/** Query key holding the packed state. Kept short — it shows up in emails. */
export const FUNNEL_RETURN_PARAM = "r";

// `btoa`/`atob` rather than `Buffer`: this module is imported from a client
// component (`booker-payment-flow`), and Node globals are not polyfilled into
// the browser bundle. Both are standard globals in Node 16+ and every browser
// we target, so one implementation serves both sides.
function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(input: string): string {
  const binary = atob(input.replace(/-/gu, "+").replace(/_/gu, "/"));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Loose shape of what arrives in `searchParams` before validation. */
type RawFunnelState = Partial<Record<keyof FunnelReturnState, string>>;

/**
 * Keeps only the keys that pass validation. Callers hand us raw search params,
 * so a junk `t=25:99` is dropped rather than packed and replayed on return.
 */
function sanitizeState(raw: RawFunnelState): FunnelReturnState {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === "") continue;
    const field = returnStateSchema.shape[key as keyof FunnelReturnState];
    if (field.safeParse(value).success) out[key] = value;
  }
  return out as FunnelReturnState;
}

/**
 * Builds the post-auth return URL for the funnel: `/{locale}/reservar?r=…`.
 *
 * Only keys with a valid value are packed, so a visitor who has not chosen
 * anything yet gets a bare `/{locale}/reservar` instead of an empty payload.
 */
export function buildFunnelReturnUrl(
  locale: string,
  raw: RawFunnelState,
): string {
  const state = sanitizeState(raw);
  if (Object.keys(state).length === 0) return `/${locale}/reservar`;

  const packed = toBase64Url(JSON.stringify(state));
  return `/${locale}/reservar?${FUNNEL_RETURN_PARAM}=${packed}`;
}

/**
 * Reverses `buildFunnelReturnUrl`. Returns `null` for anything that is not a
 * payload we produced — the value arrives from a URL, so it is untrusted input
 * and is validated with the same rules the page applies to plain search params.
 * A tampered `r` therefore degrades to "no state" rather than injecting any.
 */
export function parseFunnelReturnState(
  raw: string | undefined | null,
): FunnelReturnState | null {
  if (!raw) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(fromBase64Url(raw));
  } catch {
    return null;
  }

  const parsed = returnStateSchema.safeParse(decoded);
  if (!parsed.success) return null;

  // An object that parsed but carries nothing useful is treated as absent, so
  // callers do not have to special-case `{}`.
  return Object.keys(parsed.data).length > 0 ? parsed.data : null;
}

/**
 * The plain, user-facing funnel URL for a given state — what the packed form
 * expands back into once the visitor lands.
 */
export function buildFunnelUrl(
  locale: string,
  state: FunnelReturnState,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value !== undefined && value !== "") qs.set(key, value);
  }
  const query = qs.toString();
  return `/${locale}/reservar${query ? `?${query}` : ""}`;
}
