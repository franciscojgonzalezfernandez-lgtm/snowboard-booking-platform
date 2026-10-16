import { BookingSource } from "@prisma/client";

import { KNOWN_CAMPAIGNS } from "./campaigns";
import type { Attribution } from "./types";

// F-156: turn a landing URL's query into a resolved Attribution, or null when
// there is no marketing signal (normal/direct traffic). Pure — no Next.js or
// cookie concerns here — so it is trivially unit-testable and reused by both
// the middleware (capture) and tests.

const MAX_VALUE_LEN = 64;
const CODE_RE = /^[a-z0-9-]{1,64}$/;

/** Trim, cap length, drop empties. Returns undefined for anything unusable. */
function clean(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_VALUE_LEN) return undefined;
  return trimmed;
}

/** Normalise a `?c=` code: lowercase, must match the strict code charset. */
function cleanCode(raw: string | null): string | undefined {
  const v = clean(raw);
  if (!v) return undefined;
  const lower = v.toLowerCase();
  return CODE_RE.test(lower) ? lower : undefined;
}

/**
 * Classify an online visit from its UTM/ad-click signals. `utm_medium` is the
 * primary signal; `gclid`/`fbclid` are fallbacks for ads that auto-tag the
 * click id but not the medium. Anything unrecognised → OTHER.
 */
function channelFromOnline(
  medium: string | undefined,
  source: string | undefined,
  gclid: boolean,
  fbclid: boolean,
): BookingSource {
  const m = medium?.toLowerCase();
  const s = source?.toLowerCase();

  if (m) {
    if (["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-search"].includes(m)) {
      return BookingSource.PAID_SEARCH;
    }
    if (m === "organic") return BookingSource.ORGANIC_SEARCH;
    if (["social", "paidsocial", "paid-social", "paid_social"].includes(m)) {
      return BookingSource.SOCIAL;
    }
    if (m === "referral") return BookingSource.REFERRAL;
  }

  if (s && ["facebook", "instagram", "meta", "tiktok", "linkedin", "x", "twitter"].includes(s)) {
    return BookingSource.SOCIAL;
  }

  if (gclid) return BookingSource.PAID_SEARCH;
  if (fbclid) return BookingSource.SOCIAL;

  return BookingSource.OTHER;
}

/**
 * Resolve the attribution for a landing URL. Precedence: an offline `?c=` code
 * wins (the owner's own taxonomy for QR codes); otherwise classify from UTM /
 * ad-click signals; otherwise null (no signal → the caller leaves DIRECT).
 */
export function parseAttribution(params: URLSearchParams): Attribution | null {
  const code = cleanCode(params.get("c"));
  if (code) {
    return {
      channel: KNOWN_CAMPAIGNS[code]?.channel ?? BookingSource.OTHER,
      campaign: code,
    };
  }

  const utmSource = clean(params.get("utm_source"));
  const utmMedium = clean(params.get("utm_medium"));
  const utmCampaign = clean(params.get("utm_campaign"));
  const gclid = Boolean(clean(params.get("gclid")));
  const fbclid = Boolean(clean(params.get("fbclid")));

  if (!utmSource && !utmMedium && !utmCampaign && !gclid && !fbclid) {
    return null;
  }

  return {
    channel: channelFromOnline(utmMedium, utmSource, gclid, fbclid),
    ...(utmCampaign ? { campaign: utmCampaign } : {}),
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
  };
}
