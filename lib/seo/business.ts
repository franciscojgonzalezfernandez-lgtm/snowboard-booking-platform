import { OPERATIONAL_PHONE_TEL } from "@/lib/contact/phone";
import { SITE_URL } from "@/lib/seo/site-url";

// Single source of truth for the business's identity, service area and operating
// window, consumed by the Schema.org builders in `structured-data.ts` (F-100).
// Mirrors the seed (F-021): one school, "The Drop", Flumserberg, winter season
// 26/27 with 08:00–17:00 operating hours.
//
// The Drop is a SERVICE-AREA BUSINESS — no fixed premises. Lessons happen out on
// Flumserberg, not at a storefront. So the emitted LocalBusiness deliberately
// carries NO precise `geo` and NO `postalCode`/`streetAddress`: only a general
// locality + `areaServed`. This matches Google's service-area-business guidance
// and the reality that the Google Business Profile can't pass storefront video
// verification. The parked precise values live in {@link LOCATION_PENDING} and
// get wired back once D-PLACE resolves — see F-112.

/** Stable JSON-LD node id for the business, referenced by `@id` so Course /
 * Person / Offer nodes can point back at the same entity across pages. */
export const BUSINESS_ID = `${SITE_URL}/#business`;

/**
 * FLAG — owner-dependent SEO data still pending, wired by F-112.
 *
 * Everything here is blocked on the owner completing an external step, so it is
 * intentionally NOT emitted yet. `structured-data.ts` degrades clean while these
 * stay empty/parked. Do not "fix" by inventing values.
 *
 * - `precisePin` / `postalCode`: restore into the LocalBusiness node once the
 *   business either verifies its Google Business Profile as a service-area
 *   business or takes fixed premises (D-PLACE). Values kept so they aren't lost.
 * - `sameAs`: Google Maps URL (from the CID/Place ID) + social profiles. The
 *   owner has no Instagram/Facebook yet and the GBP is unverified, so this is
 *   empty; a dead Maps URL would be worse than none.
 */
export const LOCATION_PENDING = {
  /** Flumserberg ski area (Tannenbodenalp) — re-add as `geo` when D-PLACE lands. */
  precisePin: { latitude: 47.0884, longitude: 9.287 },
  postalCode: "8898",
  /** CID of the (unverified) Google Business Profile; builds the Maps sameAs. */
  googleCid: "15514449138658354283",
} as const;

export const BUSINESS = {
  name: "The Drop",
  url: SITE_URL,
  telephone: OPERATIONAL_PHONE_TEL,
  description:
    "Private snowboard lessons in Flumserberg, Switzerland — one certified instructor, beginners to advanced, kids and adults, taught in English, German and Spanish.",
  /** Service-area business: general locality only, no street or postal code. */
  address: {
    locality: "Flumserberg",
    region: "St. Gallen",
    country: "CH",
  },
  areaServed: ["Flumserberg", "St. Gallen", "Northern Switzerland"],
  /** Winter operating window + daily hours from the active Season (seed F-021). */
  openingHours: {
    days: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    opens: "08:00",
    closes: "17:00",
    validFrom: "2026-11-15",
    validThrough: "2027-04-30",
  },
  /**
   * Off-platform profiles for `sameAs`. Instagram is live. Still pending (F-112):
   * the Google Business Profile Maps URL (GBP unverified → a dead link would be
   * worse than none) and any further socials. `buildLocalBusiness` omits `sameAs`
   * only when this is empty.
   */
  sameAs: ["https://www.instagram.com/rideflumserberg.ch"] as readonly string[],
} as const;
