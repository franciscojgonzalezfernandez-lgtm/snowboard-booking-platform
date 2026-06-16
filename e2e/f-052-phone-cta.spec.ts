import { test, expect, type Page } from "@playwright/test";

type Locale = "en" | "de" | "es";
const LOCALES: Locale[] = ["en", "de", "es"];

const TEL_HREF = "tel:+41766381870";

async function viewport(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
}

test.describe("F-052 — operational phone CTA", () => {
  for (const locale of LOCALES) {
    test(`desktop nav phone link has exact tel href (${locale})`, async ({
      page,
    }) => {
      await viewport(page, 1280, 800);
      await page.goto(`/${locale}`);

      const phone = page.getByTestId("site-nav-phone");
      await expect(phone).toBeVisible();
      await expect(phone).toHaveAttribute("href", TEL_HREF);
    });

    test(`footer phone link has exact tel href (${locale})`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);

      const phone = page.getByTestId("footer-phone-link");
      await expect(phone).toBeVisible();
      await expect(phone).toHaveAttribute("href", TEL_HREF);
      // Displayed number keeps CH spacing.
      await expect(phone).toContainText("+41 76 638 18 70");
    });

    test(`mobile sheet phone CTA is present after opening hamburger (${locale})`, async ({
      page,
    }) => {
      await viewport(page, 375, 667);
      await page.goto(`/${locale}`);

      // Desktop nav phone is hidden on mobile (lg:flex container).
      await expect(page.getByTestId("site-nav-phone")).toBeHidden();

      await page.getByTestId("mobile-nav-trigger").click();
      const phone = page.getByTestId("mobile-nav-phone");
      await expect(phone).toBeVisible();
      await expect(phone).toHaveAttribute("href", TEL_HREF);
    });
  }
});
