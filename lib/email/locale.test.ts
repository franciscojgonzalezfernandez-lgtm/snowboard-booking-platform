import { describe, expect, it } from "vitest";
import { getEmailLocaleFromRequest, resolveEmailLocale } from "./locale";

describe("resolveEmailLocale", () => {
  it("returns en when input is empty", () => {
    expect(resolveEmailLocale(undefined)).toBe("en");
    expect(resolveEmailLocale(null)).toBe("en");
    expect(resolveEmailLocale("")).toBe("en");
  });

  it.each([
    ["de", "de"],
    ["DE", "de"],
    ["de-CH", "de"],
    ["es-ES,es;q=0.9,en;q=0.8", "es"],
    ["fr-FR,fr;q=0.9", "en"],
    ["en-US", "en"],
  ] as const)("normalizes %s to %s", (input, expected) => {
    expect(resolveEmailLocale(input)).toBe(expected);
  });
});

function mockRequest(headers: Record<string, string>) {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  };
}

describe("getEmailLocaleFromRequest", () => {
  it("prefers NEXT_LOCALE cookie over Accept-Language", () => {
    const req = mockRequest({
      cookie: "NEXT_LOCALE=de; other=1",
      "accept-language": "es",
    });
    expect(getEmailLocaleFromRequest(req)).toBe("de");
  });

  it("falls back to Accept-Language when cookie missing", () => {
    const req = mockRequest({ "accept-language": "es-ES,es;q=0.9" });
    expect(getEmailLocaleFromRequest(req)).toBe("es");
  });

  it("falls back to Accept-Language when cookie value is unsupported", () => {
    const req = mockRequest({
      cookie: "NEXT_LOCALE=fr",
      "accept-language": "es",
    });
    expect(getEmailLocaleFromRequest(req)).toBe("es");
  });

  it("returns en when no request is provided", () => {
    expect(getEmailLocaleFromRequest(undefined)).toBe("en");
    expect(getEmailLocaleFromRequest(null)).toBe("en");
  });
});
