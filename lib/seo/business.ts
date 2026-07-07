import { OPERATIONAL_PHONE_TEL } from "@/lib/contact/phone";
import { SITE_URL } from "@/lib/seo/site-url";

// Single source of truth for the business's NAP (name, address, phone), geo and
// operating window, consumed by the Schema.org builders in `structured-data.ts`
// (F-100). Mirrors the seed (F-021): one school, "The Drop", Flumserberg, winter
// season 26/27 with 08:00–17:00 operating hours.

/** Stable JSON-LD node id for the business, referenced by `@id` so Course /
 * Person / Offer nodes can point back at the same entity across pages. */
export const BUSINESS_ID = `${SITE_URL}/#business`;

export const BUSINESS = {
  name: "The Drop",
  url: SITE_URL,
  telephone: OPERATIONAL_PHONE_TEL,
  description:
    "Private snowboard lessons in Flumserberg, Switzerland — one certified instructor, beginners to advanced, kids and adults, taught in English, German and Spanish.",
  address: {
    locality: "Flumserberg",
    region: "St. Gallen",
    postalCode: "8898",
    country: "CH",
  },
  /** Flumserberg ski area (Tannenbodenalp). */
  geo: { latitude: 47.0884, longitude: 9.287 },
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
   * Off-platform profiles (Google Business Profile, social). Empty until
   * D-PLACE lands (Google Place ID, postal verification) and the owner supplies
   * social URLs; `buildLocalBusiness` omits `sameAs` entirely while empty.
   */
  sameAs: [] as readonly string[],
} as const;
