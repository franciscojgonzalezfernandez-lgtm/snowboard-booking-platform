import { describe, expect, test } from "vitest";

import {
  LINK_PRESETS,
  buildUtmUrl,
  offlineCodeUrl,
  slugify,
} from "./campaign-link";

const preset = (id: string) => LINK_PRESETS.find((p) => p.id === id)!;

describe("slugify", () => {
  test("lowercases, spaces→-, strips other chars", () => {
    expect(slugify("Winter Promo")).toBe("winter-promo");
    expect(slugify("  Beginners 2026!  ")).toBe("beginners-2026");
    expect(slugify("")).toBe("");
  });
});

describe("buildUtmUrl", () => {
  test("instagram + campaign", () => {
    expect(buildUtmUrl(preset("instagram"), "Winter Promo")).toBe(
      "https://rideflumserberg.ch/?utm_source=instagram&utm_medium=social&utm_campaign=winter-promo",
    );
  });

  test("google ads is cpc", () => {
    expect(buildUtmUrl(preset("google"), "beginners")).toBe(
      "https://rideflumserberg.ch/?utm_source=google&utm_medium=cpc&utm_campaign=beginners",
    );
  });

  test("SEO preset omits source", () => {
    expect(buildUtmUrl(preset("seo"), "")).toBe(
      "https://rideflumserberg.ch/?utm_medium=organic",
    );
  });

  test("empty campaign omits utm_campaign", () => {
    expect(buildUtmUrl(preset("tiktok"), "   ")).toBe(
      "https://rideflumserberg.ch/?utm_source=tiktok&utm_medium=social",
    );
  });
});

describe("offlineCodeUrl", () => {
  test("builds the ?c= URL", () => {
    expect(offlineCodeUrl("flyer-talstation")).toBe(
      "https://rideflumserberg.ch/?c=flyer-talstation",
    );
  });
});
