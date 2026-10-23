import { BookingSource } from "@prisma/client";

import type { Attribution } from "./types";

// F-156: the first-touch attribution cookie. Set by the middleware on arrival
// (only if absent → first touch wins), read server-side in the createBookingDraft
// Server Action, and cleared once a booking is created. httpOnly because only the
// server ever reads it; `lax` so it survives the top-level navigation from the QR
// landing; 90-day life so a visitor who books days later is still attributed.

export const ATTRIBUTION_COOKIE = "ride_attr";
export const ATTRIBUTION_MAX_AGE_DAYS = 90;
export const ATTRIBUTION_MAX_AGE_SECONDS = ATTRIBUTION_MAX_AGE_DAYS * 24 * 60 * 60;

// Compact on-the-wire shape (short keys to keep the cookie small).
type Wire = { c: string; k?: string; s?: string; m?: string };

const VALID_CHANNELS = new Set<string>(Object.values(BookingSource));

export function encodeAttribution(attr: Attribution): string {
  const wire: Wire = { c: attr.channel };
  if (attr.campaign) wire.k = attr.campaign;
  if (attr.utmSource) wire.s = attr.utmSource;
  if (attr.utmMedium) wire.m = attr.utmMedium;
  return encodeURIComponent(JSON.stringify(wire));
}

/**
 * Decode the cookie value back to an Attribution. Returns null for anything
 * malformed or carrying an unknown channel — the cookie is attacker-reachable,
 * so a bad value must never throw or inject a bogus enum into a DB write.
 */
export function decodeAttribution(
  raw: string | null | undefined,
): Attribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const wire = parsed as Partial<Wire>;
    if (typeof wire.c !== "string" || !VALID_CHANNELS.has(wire.c)) return null;
    return {
      channel: wire.c as BookingSource,
      ...(typeof wire.k === "string" && wire.k ? { campaign: wire.k } : {}),
      ...(typeof wire.s === "string" && wire.s ? { utmSource: wire.s } : {}),
      ...(typeof wire.m === "string" && wire.m ? { utmMedium: wire.m } : {}),
    };
  } catch {
    return null;
  }
}
