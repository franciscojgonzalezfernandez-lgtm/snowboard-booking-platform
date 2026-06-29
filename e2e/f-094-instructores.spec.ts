import { test, expect } from "@playwright/test";

const HEADING = {
  en: "Who you'll ride with",
  de: "Wer dir das Riden beibringt",
  es: "Con quién vas a montar",
} as const;

const LOCALES = ["en", "de", "es"] as const;

// Owner instructor seeded as "Javi" → derived slug "javi".
const OWNER_SLUG = "javi";

// F-102 — the instructors index slug is translated per locale.
const INDEX_SLUG = {
  en: "instructors",
  de: "instruktoren",
  es: "instructores",
} as const;

test.describe("F-094 — Instructors index + profiles", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/${INDEX_SLUG[locale]} lists active instructors`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/${INDEX_SLUG[locale]}`);

      await expect(page.locator("h1")).toContainText(HEADING[locale]);

      const cards = page.getByTestId("instructor-card");
      expect(await cards.count()).toBeGreaterThan(0);

      const ownerCard = page.locator(
        `[data-testid="instructor-card"][href$="/${INDEX_SLUG[locale]}/${OWNER_SLUG}"]`,
      );
      await expect(ownerCard).toBeVisible();
    });

    test(`/${locale} profile resolves by slug and CTA goes to the funnel`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/${INDEX_SLUG[locale]}/${OWNER_SLUG}`);

      await expect(page.getByTestId("instructor-name")).toContainText("Javi");

      const cta = page.getByTestId("instructor-cta");
      await expect(cta).toHaveAttribute("href", `/${locale}/reservar`);
    });
  }

  test("card navigates to the profile", async ({ page }) => {
    await page.goto(`/en/${INDEX_SLUG.en}`);
    await page
      .locator(
        `[data-testid="instructor-card"][href$="/${INDEX_SLUG.en}/${OWNER_SLUG}"]`,
      )
      .click();
    await page.waitForURL(`**/${INDEX_SLUG.en}/${OWNER_SLUG}`);
    await expect(page.getByTestId("instructor-name")).toContainText("Javi");
  });

  test("unknown slug returns 404", async ({ page }) => {
    const res = await page.goto(`/en/${INDEX_SLUG.en}/no-such-coach`);
    expect(res?.status()).toBe(404);
  });
});
