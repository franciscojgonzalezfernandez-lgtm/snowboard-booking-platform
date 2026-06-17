import { describe, expect, test } from "vitest";

import { OPERATIONAL_PHONE_TEL } from "@/lib/contact/phone";

import { isAllowedCtaHref, resolveCtaHref } from "./hero-announcement";

describe("resolveCtaHref", () => {
  test("maps the 'phone' sentinel to the F-052 operational phone tel:", () => {
    expect(resolveCtaHref("phone")).toBe(`tel:${OPERATIONAL_PHONE_TEL}`);
  });

  test("passes other hrefs through unchanged", () => {
    expect(resolveCtaHref("/contacto")).toBe("/contacto");
    expect(resolveCtaHref("https://example.test")).toBe("https://example.test");
  });
});

describe("isAllowedCtaHref", () => {
  test("allows internal paths and tel/mailto/https schemes", () => {
    expect(isAllowedCtaHref("/contacto")).toBe(true);
    expect(isAllowedCtaHref("tel:+41766381870")).toBe(true);
    expect(isAllowedCtaHref("mailto:hi@example.test")).toBe(true);
    expect(isAllowedCtaHref("https://example.test")).toBe(true);
  });

  test("rejects dangerous and protocol-relative schemes", () => {
    expect(isAllowedCtaHref("//evil.test")).toBe(false);
    expect(isAllowedCtaHref("javascript:alert(1)")).toBe(false);
    expect(isAllowedCtaHref("data:text/html,evil")).toBe(false);
    expect(isAllowedCtaHref("http://insecure.test")).toBe(false);
  });
});
