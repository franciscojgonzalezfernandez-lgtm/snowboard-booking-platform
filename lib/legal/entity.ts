import {
  OPERATIONAL_PHONE_DISPLAY,
  OPERATIONAL_PHONE_TEL,
} from "@/lib/contact/phone";

// Single source of truth for the LEGAL identity of the operator behind
// rideflumserberg.ch, consumed by the Impressum page (F-153), the site footer
// and the privacy "data controller" section.
//
// Deliberately SEPARATE from `lib/seo/business.ts` (`BUSINESS`). That constant
// describes the service-area brand at Flumserberg for Schema.org and keeps its
// precise `geo`/`postalCode` parked (F-112). This one is the registered legal
// domicile of the sole proprietorship (Uster, ZH) — a different address for a
// different purpose. Do NOT feed these values into the Schema.org LocalBusiness
// or merge the two: the legal seat is not where lessons are provided.
//
// Why it exists: TWINT's onboarding requirements (docs.stripe.com/payments/twint)
// mandate that the website display, in the legal notice / T&C / conditions, the
// business name and legal form, the full address, and a contact — visibly. A
// sole proprietorship (Einzelfirma) must additionally show the owner's full
// name. Missing this is the most likely cause of the `twint_payments`
// capability being rejected (`rejected.other`).
export const LEGAL_ENTITY = {
  /** Public brand / trade name (matches `BUSINESS.name`). */
  tradeName: "Ride Flumserberg",
  /** Registered firm name of the sole proprietorship. */
  legalName: "Gonzalez Fernandez Snowball Effect",
  /** Swiss legal form. Kept as the Swiss term; pages may gloss it per locale. */
  legalForm: "Einzelfirma",
  /** Full legal name of the proprietor — required on an Einzelfirma notice. */
  owner: "Francisco Javier González Fernández",
  /** Registered legal domicile (canton Zürich) — NOT the service area. */
  address: {
    street: "Josefstrasse 4",
    postalCode: "8610",
    locality: "Uster",
    /** ISO country code; display name is localized in the message catalog. */
    country: "CH",
  },
  email: "franciscojgonzalezfernandez@gmail.com",
  phoneDisplay: OPERATIONAL_PHONE_DISPLAY,
  phoneTel: OPERATIONAL_PHONE_TEL,
} as const;
