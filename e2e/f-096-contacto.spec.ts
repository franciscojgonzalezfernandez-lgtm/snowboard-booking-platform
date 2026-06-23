import { test, expect } from "@playwright/test";

const LOCALES = ["en", "de", "es"] as const;

const HEADING = {
  en: "Talk to me before you book",
  de: "Sprich mit mir, bevor du buchst",
  es: "Habla conmigo antes de reservar",
} as const;

// Single source of truth lives in lib/contact/{phone,email}.ts — the page must
// render these exact hrefs (F-052 phone, F-096 email).
const PHONE_HREF = "tel:+41766381870";
const EMAIL_HREF = "mailto:hello@rideflumserberg.ch";

test.describe("F-096 — Contact page", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/contacto renders with native tel: and mailto: CTAs`, async ({
      page,
    }) => {
      const res = await page.goto(`/${locale}/contacto`);
      expect(res?.status()).toBe(200);

      await expect(page.locator("h1")).toContainText(HEADING[locale]);

      await expect(page.getByTestId("contact-phone")).toHaveAttribute(
        "href",
        PHONE_HREF,
      );
      await expect(page.getByTestId("contact-email")).toHaveAttribute(
        "href",
        EMAIL_HREF,
      );

      // Lean page contract (F-096): no form, just the static contact surfaces.
      await expect(page.getByTestId("contact-hours")).toBeVisible();
      await expect(page.getByTestId("contact-meeting")).toBeVisible();

      // Outbound directions link → Google Maps (a plain <a>, sets no cookies).
      await expect(page.getByTestId("contact-map-link")).toHaveAttribute(
        "href",
        /google\.com\/maps/,
      );

      // Click-to-load map: a cookieless placeholder renders first; the Google
      // iframe (which sets a tracking cookie) only mounts after an explicit
      // click — consent-by-action, no banner needed.
      await expect(page.getByTestId("contact-map")).toHaveCount(0);
      await page.getByTestId("contact-map-placeholder").click();
      await expect(page.getByTestId("contact-map")).toHaveAttribute(
        "src",
        /google\.com\/maps/,
      );

      await expect(page.locator("form")).toHaveCount(0);
    });
  }

  test("contact page is reachable from the nav and footer links", async ({
    page,
  }) => {
    await page.goto("/en");

    await expect(page.getByTestId("site-nav-contact")).toHaveAttribute(
      "href",
      "/en/contacto",
    );
    await expect(page.getByTestId("footer-contact-link")).toHaveAttribute(
      "href",
      "/en/contacto",
    );

    await page.getByTestId("site-nav-contact").click();
    await page.waitForURL(/\/contacto$/);
    await expect(page.getByTestId("contact-page")).toBeVisible();
  });
});
