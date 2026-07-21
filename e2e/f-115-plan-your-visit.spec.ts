import { test, expect } from "@playwright/test";

// F-115 — "Plan your visit" hub. Slugs are translated (F-102 pathnames).
const SLUG = {
  en: "plan-your-visit",
  de: "plane-deinen-besuch",
  es: "planea-tu-visita",
} as const;

const RESORT_HOURS_URL = "https://www.flumserberg.ch/Operating-hours";
const INTERSPORT_RENT_URL =
  "https://www.intersportrent.com/skirent-flumserberg";

const LOCALES = ["en", "de", "es"] as const;

test.describe("F-115 — Plan your visit", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/${SLUG[locale]} renders with live season + safe outbound links`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/${SLUG[locale]}`);
      await expect(page.getByTestId("plan-your-visit-page")).toBeVisible();

      // Season block is live from the active Season row → shows a real year.
      const season = page.getByTestId("plan-season-status");
      await expect(season).toBeVisible();
      await expect(season).toHaveText(/202\d/);

      // Resort operating-hours: canonical resort page, new tab, safe rel.
      const hours = page.getByTestId("plan-hours-link");
      await expect(hours).toHaveAttribute("href", RESORT_HOURS_URL);
      await expect(hours).toHaveAttribute("target", "_blank");
      await expect(hours).toHaveAttribute("rel", /noopener/);

      // Gear rental → owner-recommended Intersport Rent, with the real shops listed.
      await expect(page.getByTestId("plan-rental-link")).toHaveAttribute(
        "href",
        INTERSPORT_RENT_URL,
      );
      await expect(
        page.getByText("Intersport Flumserberg", { exact: false }).first(),
      ).toBeVisible();
    });
  }

  test("footer link navigates to the localized hub", async ({ page }) => {
    await page.goto("/en");
    await page.getByTestId("footer-plan-link").click();
    await page.waitForURL(`**/en/${SLUG.en}`);
    await expect(page.getByTestId("plan-your-visit-page")).toBeVisible();
  });

  test("a non-canonical slug 307s to the locale's canonical slug (F-102)", async ({
    request,
  }) => {
    // The EN slug under the /de prefix → redirect to the DE slug.
    const res = await request.get(`/de/${SLUG.en}`, { maxRedirects: 0 });
    expect([307, 308]).toContain(res.status());
    expect(res.headers()["location"]).toContain(`/de/${SLUG.de}`);
  });
});
