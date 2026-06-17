import { test, expect } from "@playwright/test";

const HEADING = {
  en: "Who you'll ride with",
  de: "Wer dir das Riden beibringt",
  es: "Con quién vas a montar",
} as const;

const LOCALES = ["en", "de", "es"] as const;

// Owner instructor seeded as "Javi" → derived slug "javi".
const OWNER_SLUG = "javi";

test.describe("F-094 — Instructors index + profiles", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/instructores lists active instructors`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/instructores`);

      await expect(page.locator("h1")).toContainText(HEADING[locale]);

      const cards = page.getByTestId("instructor-card");
      expect(await cards.count()).toBeGreaterThan(0);

      const ownerCard = page.locator(
        `[data-testid="instructor-card"][href$="/instructores/${OWNER_SLUG}"]`,
      );
      await expect(ownerCard).toBeVisible();
    });

    test(`/${locale} profile resolves by slug and CTA goes to the funnel`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/instructores/${OWNER_SLUG}`);

      await expect(page.getByTestId("instructor-name")).toContainText("Javi");

      const cta = page.getByTestId("instructor-cta");
      await expect(cta).toHaveAttribute("href", `/${locale}/reservar`);
    });
  }

  test("card navigates to the profile", async ({ page }) => {
    await page.goto("/en/instructores");
    await page
      .locator(
        `[data-testid="instructor-card"][href$="/instructores/${OWNER_SLUG}"]`,
      )
      .click();
    await page.waitForURL(`**/instructores/${OWNER_SLUG}`);
    await expect(page.getByTestId("instructor-name")).toContainText("Javi");
  });

  test("unknown slug returns 404", async ({ page }) => {
    const res = await page.goto("/en/instructores/no-such-coach");
    expect(res?.status()).toBe(404);
  });
});
