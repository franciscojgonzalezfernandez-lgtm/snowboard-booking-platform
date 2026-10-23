import { describe, expect, test } from "vitest";

import { campaignLabel, normalizeSource, sourceDisplay } from "./campaigns";

describe("campaignLabel", () => {
  test("known code → configured label", () => {
    expect(campaignLabel("flyer-talstation")).toBe("Flyer · Talstation");
  });
  test("unknown code → raw code; empty → null", () => {
    expect(campaignLabel("mystery")).toBe("mystery");
    expect(campaignLabel(null)).toBeNull();
    expect(campaignLabel(undefined)).toBeNull();
  });
});

describe("normalizeSource", () => {
  test("folds platform aliases to one token", () => {
    expect(normalizeSource("instagram")).toBe("instagram");
    expect(normalizeSource("IG")).toBe("instagram");
    expect(normalizeSource("insta")).toBe("instagram");
    expect(normalizeSource("fb")).toBe("facebook");
    expect(normalizeSource("meta")).toBe("facebook");
    expect(normalizeSource("TikTok")).toBe("tiktok");
  });
  test("unknown source kept lowercased; empty → null", () => {
    expect(normalizeSource("newsletter")).toBe("newsletter");
    expect(normalizeSource("  ")).toBeNull();
    expect(normalizeSource(null)).toBeNull();
  });
});

describe("sourceDisplay", () => {
  test("nice-cases known platforms, passes others through", () => {
    expect(sourceDisplay("ig")).toBe("Instagram");
    expect(sourceDisplay("tiktok")).toBe("TikTok");
    expect(sourceDisplay("facebook")).toBe("Facebook");
    expect(sourceDisplay("newsletter")).toBe("newsletter");
    expect(sourceDisplay(null)).toBeNull();
  });
});
