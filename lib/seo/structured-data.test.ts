import { describe, expect, it } from "vitest";
import { Duration } from "@prisma/client";

import {
  buildBlogPosting,
  buildCourse,
  buildFaqPage,
  buildLocalBusiness,
  buildPerson,
} from "@/lib/seo/structured-data";
import { BUSINESS, BUSINESS_ID } from "@/lib/seo/business";

describe("buildLocalBusiness", () => {
  it("emits a LocalBusiness/SportsActivityLocation with NAP, geo and hours", () => {
    const node = buildLocalBusiness();

    expect(node["@type"]).toEqual(["LocalBusiness", "SportsActivityLocation"]);
    expect(node["@id"]).toBe(BUSINESS_ID);
    expect(node.name).toBe("The Drop");
    expect(node.telephone).toBe(BUSINESS.telephone);

    const address = node.address as Record<string, unknown>;
    expect(address["@type"]).toBe("PostalAddress");
    expect(address.addressLocality).toBe("Flumserberg");
    expect(address.addressCountry).toBe("CH");

    const geo = node.geo as Record<string, unknown>;
    expect(geo["@type"]).toBe("GeoCoordinates");
    expect(typeof geo.latitude).toBe("number");

    const hours = node.openingHoursSpecification as Record<string, unknown>[];
    expect(hours).toHaveLength(1);
    const [spec] = hours;
    expect((spec!.dayOfWeek as string[]).length).toBe(7);
    expect(spec!.opens).toBe("08:00");
    expect(spec!.closes).toBe("17:00");
  });

  it("omits priceRange, sameAs and aggregateRating by default (D-PLACE gate)", () => {
    const node = buildLocalBusiness();
    expect(node.priceRange).toBeUndefined();
    expect(node.aggregateRating).toBeUndefined();
    // sameAs is empty until D-PLACE / owner supplies profiles.
    expect(node.sameAs).toBeUndefined();
  });

  it("includes priceRange when provided", () => {
    const node = buildLocalBusiness({ priceRange: "CHF 120–600" });
    expect(node.priceRange).toBe("CHF 120–600");
  });

  it("includes aggregateRating ONLY when real aggregates are passed", () => {
    const node = buildLocalBusiness({
      aggregateRating: { ratingValue: 4.9, reviewCount: 37 },
    });
    expect(node.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.9,
      reviewCount: 37,
    });
  });
});

describe("buildCourse", () => {
  it("emits a Course with a CHF Offer priced from integer cents", () => {
    const node = buildCourse({
      name: "2-hour snowboard lesson",
      description: "First day on a board.",
      url: "https://rideflumserberg.ch/en/precios",
      duration: Duration.TWO_HOURS,
      priceCents: 24000,
    });

    expect(node["@type"]).toBe("Course");
    expect(node.name).toBe("2-hour snowboard lesson");

    const offer = node.offers as Record<string, unknown>;
    expect(offer["@type"]).toBe("Offer");
    expect(offer.price).toBe("240.00");
    expect(offer.priceCurrency).toBe("CHF");
    expect(offer.availability).toBe("https://schema.org/InStock");

    const instance = node.hasCourseInstance as Record<string, unknown>;
    expect(instance.courseWorkload).toBe("PT2H");
    expect((instance.location as Record<string, unknown>)["@id"]).toBe(BUSINESS_ID);
  });

  it("maps each duration to its ISO 8601 workload", () => {
    const workload = (duration: Duration) =>
      (
        buildCourse({
          name: "x",
          description: "y",
          url: "https://rideflumserberg.ch/en/precios",
          duration,
          priceCents: 10000,
        }).hasCourseInstance as Record<string, unknown>
      ).courseWorkload;

    expect(workload(Duration.ONE_HOUR)).toBe("PT1H");
    expect(workload(Duration.INTENSIVE)).toBe("PT4H");
    expect(workload(Duration.FULL_DAY)).toBe("PT6H");
  });

  it("rejects non-integer or negative cents", () => {
    expect(() =>
      buildCourse({
        name: "x",
        description: "y",
        url: "u",
        duration: Duration.ONE_HOUR,
        priceCents: 120.5,
      }),
    ).toThrow();
    expect(() =>
      buildCourse({
        name: "x",
        description: "y",
        url: "u",
        duration: Duration.ONE_HOUR,
        priceCents: -1,
      }),
    ).toThrow();
  });
});

describe("buildPerson", () => {
  it("emits a Person tied to the organization with optional fields present", () => {
    const node = buildPerson({
      name: "Javi",
      url: "https://rideflumserberg.ch/en/instructores/javi",
      image: "https://rideflumserberg.ch/instructors/javi.png",
      description: "Certified coach.",
      knowsLanguage: ["en", "de", "es"],
    });

    expect(node["@type"]).toBe("Person");
    expect(node.name).toBe("Javi");
    expect(node.jobTitle).toBe("Snowboard instructor");
    expect(node.image).toBe("https://rideflumserberg.ch/instructors/javi.png");
    expect(node.knowsLanguage).toEqual(["en", "de", "es"]);
    expect((node.worksFor as Record<string, unknown>).name).toBe("The Drop");
  });

  it("omits image, description and knowsLanguage when absent", () => {
    const node = buildPerson({
      name: "Nobody",
      url: "https://rideflumserberg.ch/en/instructores/nobody",
    });
    expect(node.image).toBeUndefined();
    expect(node.description).toBeUndefined();
    expect(node.knowsLanguage).toBeUndefined();
  });
});

describe("buildFaqPage", () => {
  it("maps each item to a Question/Answer pair", () => {
    const node = buildFaqPage([
      { q: "Do you teach beginners?", a: "Yes, that's most of what I do." },
    ]);

    expect(node["@type"]).toBe("FAQPage");
    const entities = node.mainEntity as Record<string, unknown>[];
    expect(entities).toHaveLength(1);
    const [question] = entities;
    expect(question!["@type"]).toBe("Question");
    expect(question!.name).toBe("Do you teach beginners?");
    expect((question!.acceptedAnswer as Record<string, unknown>).text).toBe(
      "Yes, that's most of what I do.",
    );
  });
});

describe("buildBlogPosting", () => {
  it("emits a BlogPosting with author, publisher and defaulted dateModified", () => {
    const node = buildBlogPosting({
      headline: "Your first day on a snowboard",
      description: "What to expect.",
      url: "https://rideflumserberg.ch/en/blog/your-first-day-on-a-snowboard",
      datePublished: "2026-01-15",
      inLanguage: "en",
    });

    expect(node["@type"]).toBe("BlogPosting");
    expect(node.headline).toBe("Your first day on a snowboard");
    expect(node.mainEntityOfPage).toBe(node.url);
    expect(node.dateModified).toBe("2026-01-15");
    expect(node.inLanguage).toBe("en");
    expect((node.author as Record<string, unknown>)["@type"]).toBe("Person");
    expect((node.publisher as Record<string, unknown>).name).toBe("The Drop");
    expect(node.image).toBeUndefined();
  });
});
