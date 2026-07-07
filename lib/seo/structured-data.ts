import { Duration } from "@prisma/client";

import { BUSINESS, BUSINESS_ID } from "@/lib/seo/business";

// F-100 — Schema.org structured data builders. Each builder returns a single
// node WITHOUT `@context`; the `<JsonLd>` component injects `@context` (and wraps
// arrays in an `@graph`) and handles `<`-escaping. Builders are pure + typed so
// they can be unit-tested in isolation and reused across routes (no barrel).
//
// Currency is CHF (MVP). Money arrives as integer cents and is emitted as a
// decimal string, never a float, per the project money rules.

type JsonLdNode = Record<string, unknown>;

const CURRENCY = "CHF";

/** Integer cents → Schema.org `price` string ("12000" → "120.00"). */
function centsToPriceString(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error(`centsToPriceString expects non-negative integer cents, got ${cents}`);
  }
  return (cents / 100).toFixed(2);
}

const ORGANIZATION_REF = {
  "@type": "Organization",
  name: BUSINESS.name,
  url: BUSINESS.url,
} as const;

// --- LocalBusiness / SportsActivityLocation -------------------------------

export type AggregateRating = {
  ratingValue: number;
  reviewCount: number;
};

export type LocalBusinessOptions = {
  /** Free-text price hint, e.g. "CHF 120–600". Omitted when absent. */
  priceRange?: string;
  /**
   * Only pass real Google review aggregates — gated behind D-PLACE. Never
   * synthesise a rating; while absent the node carries no `aggregateRating`.
   */
  aggregateRating?: AggregateRating;
};

export function buildLocalBusiness(options: LocalBusinessOptions = {}): JsonLdNode {
  const node: JsonLdNode = {
    "@type": ["LocalBusiness", "SportsActivityLocation"],
    "@id": BUSINESS_ID,
    name: BUSINESS.name,
    description: BUSINESS.description,
    url: BUSINESS.url,
    telephone: BUSINESS.telephone,
    address: {
      "@type": "PostalAddress",
      addressLocality: BUSINESS.address.locality,
      addressRegion: BUSINESS.address.region,
      postalCode: BUSINESS.address.postalCode,
      addressCountry: BUSINESS.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: BUSINESS.geo.latitude,
      longitude: BUSINESS.geo.longitude,
    },
    areaServed: BUSINESS.areaServed.map((name) => ({ "@type": "Place", name })),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [...BUSINESS.openingHours.days],
        opens: BUSINESS.openingHours.opens,
        closes: BUSINESS.openingHours.closes,
        validFrom: BUSINESS.openingHours.validFrom,
        validThrough: BUSINESS.openingHours.validThrough,
      },
    ],
  };

  if (options.priceRange) node.priceRange = options.priceRange;
  if (BUSINESS.sameAs.length > 0) node.sameAs = [...BUSINESS.sameAs];
  if (options.aggregateRating) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: options.aggregateRating.ratingValue,
      reviewCount: options.aggregateRating.reviewCount,
    };
  }

  return node;
}

// --- Course + Offer (one per lesson duration) -----------------------------

/** Lesson length per duration, as an ISO 8601 duration for `courseWorkload`. */
const WORKLOAD_BY_DURATION: Record<Duration, string> = {
  ONE_HOUR: "PT1H",
  TWO_HOURS: "PT2H",
  INTENSIVE: "PT4H",
  FULL_DAY: "PT6H",
};

export type CourseInput = {
  /** Course name, e.g. "2-hour snowboard lesson". */
  name: string;
  description: string;
  /** Absolute URL where the course can be booked/viewed. */
  url: string;
  duration: Duration;
  priceCents: number;
};

export function buildCourse(input: CourseInput): JsonLdNode {
  const offer = {
    "@type": "Offer",
    price: centsToPriceString(input.priceCents),
    priceCurrency: CURRENCY,
    availability: "https://schema.org/InStock",
    url: input.url,
  };

  return {
    "@type": "Course",
    name: input.name,
    description: input.description,
    url: input.url,
    provider: ORGANIZATION_REF,
    offers: offer,
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "Onsite",
      courseWorkload: WORKLOAD_BY_DURATION[input.duration],
      location: { "@id": BUSINESS_ID },
    },
  };
}

// --- Person (instructor profile) ------------------------------------------

export type PersonInput = {
  name: string;
  /** Absolute URL of the instructor's public profile. */
  url: string;
  /** Absolute image URL, or null/undefined to omit. */
  image?: string | null;
  description?: string;
  /** BCP-47-ish language codes the instructor teaches in (e.g. ["en","de"]). */
  knowsLanguage?: readonly string[];
  jobTitle?: string;
};

export function buildPerson(input: PersonInput): JsonLdNode {
  const node: JsonLdNode = {
    "@type": "Person",
    name: input.name,
    url: input.url,
    jobTitle: input.jobTitle ?? "Snowboard instructor",
    worksFor: ORGANIZATION_REF,
  };

  if (input.image) node.image = input.image;
  if (input.description) node.description = input.description;
  if (input.knowsLanguage && input.knowsLanguage.length > 0) {
    node.knowsLanguage = [...input.knowsLanguage];
  }

  return node;
}

// --- FAQPage --------------------------------------------------------------

export type FaqEntry = { q: string; a: string };

export function buildFaqPage(items: readonly FaqEntry[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

// --- BlogPosting ----------------------------------------------------------

export type BlogPostingInput = {
  headline: string;
  description: string;
  /** Absolute URL of the post. */
  url: string;
  /** ISO date (YYYY-MM-DD) or full ISO timestamp. */
  datePublished: string;
  dateModified?: string;
  /** Absolute image URL, or null/undefined to omit. */
  image?: string | null;
  authorName?: string;
  /** Locale code of the post body, e.g. "de". */
  inLanguage?: string;
};

export function buildBlogPosting(input: BlogPostingInput): JsonLdNode {
  const node: JsonLdNode = {
    "@type": "BlogPosting",
    headline: input.headline,
    description: input.description,
    url: input.url,
    mainEntityOfPage: input.url,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: { "@type": "Person", name: input.authorName ?? "Javi" },
    publisher: ORGANIZATION_REF,
  };

  if (input.image) node.image = input.image;
  if (input.inLanguage) node.inLanguage = input.inLanguage;

  return node;
}
