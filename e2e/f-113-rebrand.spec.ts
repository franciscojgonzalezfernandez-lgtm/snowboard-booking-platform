import { test, expect } from "@playwright/test";

// F-113 — the brand name "The Drop" is retired in favour of "Ride Flumserberg".
// This is a regression guard: the old proper noun must not resurface anywhere in
// the rendered DOM or the document title of the highest-traffic public surfaces.
// The verb/slang "drop" (dropping in, the half-second before a line) is kept, so
// we assert on the exact branded string "The Drop", not the substring "drop".

const LOCALES = ["en", "de", "es"] as const;

// About lives behind translated slugs (F-102).
const ABOUT_SLUG = { en: "about", de: "ueber-uns", es: "sobre" } as const;

test.describe("F-113 — no 'The Drop' brand string leaks to production", () => {
  for (const locale of LOCALES) {
    for (const path of ["", `/${ABOUT_SLUG[locale]}`]) {
      test(`/${locale}${path} carries the new brand, not the old one`, async ({
        page,
      }) => {
        await page.goto(`/${locale}${path}`);

        // Title (the organic ad copy) must be rebranded.
        await expect(page).not.toHaveTitle(/The Drop/);

        // No occurrence anywhere in the rendered document — body copy, footer,
        // nav, headings, aria labels surfaced as text.
        const bodyText = await page.locator("body").innerText();
        expect(bodyText).not.toContain("The Drop");

        // Footer specifically (© line + brand wordmark) reads the new name.
        await expect(page.locator("footer")).toContainText("Ride Flumserberg");
      });
    }
  }
});
