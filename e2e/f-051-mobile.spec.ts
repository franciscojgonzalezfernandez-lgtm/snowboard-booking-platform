import { test, expect, type Page } from "@playwright/test";

type Locale = "en" | "de" | "es";
const LOCALES: Locale[] = ["en", "de", "es"];

const VIEWPORTS = [
  { name: "iphone-se1", width: 320, height: 568 },
  { name: "iphone-se2", width: 375, height: 667 },
  { name: "iphone-14", width: 390, height: 844 },
  { name: "iphone-xr", width: 414, height: 896 },
  { name: "ipad-mini", width: 768, height: 1024 },
] as const;

async function setViewport(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
}

async function rootHorizontalOverflow(page: Page, vw: number): Promise<number> {
  return page.evaluate((width) => {
    const offenders = Array.from(document.querySelectorAll("body *")).filter(
      (el) =>
        el.scrollWidth > width + 1 &&
        el.tagName !== "HTML" &&
        el.tagName !== "BODY" &&
        getComputedStyle(el).overflowX !== "hidden",
    );
    return offenders.length;
  }, vw);
}

test.describe("F-051 — mobile audit + hamburger Sheet", () => {
  test.describe("SiteNav hamburger Sheet (mobile only)", () => {
    test("mobile (320): hamburger trigger visible, desktop nav hidden", async ({
      page,
    }) => {
      await setViewport(page, 320, 568);
      await page.goto("/en");

      await expect(page.getByTestId("mobile-nav-trigger")).toBeVisible();
      // Desktop signin pill lives outside the Sheet and is lg:flex only.
      await expect(
        page.locator('a[href*="/login"]').first(),
      ).toBeHidden();
    });

    test("desktop (1280): hamburger hidden, desktop nav visible", async ({
      page,
    }) => {
      await setViewport(page, 1280, 800);
      await page.goto("/en");

      await expect(page.getByTestId("mobile-nav-trigger")).toBeHidden();
    });

    test("hamburger trigger meets 44×44 tap target on mobile", async ({
      page,
    }) => {
      await setViewport(page, 375, 667);
      await page.goto("/en");

      const trigger = page.getByTestId("mobile-nav-trigger");
      const box = await trigger.boundingBox();
      expect(box, "trigger must be measurable").not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    });

    test("tap hamburger opens Sheet with nav links + CTA", async ({ page }) => {
      await setViewport(page, 375, 667);
      await page.goto("/en");

      await page.getByTestId("mobile-nav-trigger").click();
      const sheet = page.getByTestId("mobile-nav-sheet");
      await expect(sheet).toBeVisible();

      // Sheet contains all 5 nav entries + Sign in CTA (anonymous).
      await expect(sheet.getByText("About", { exact: true })).toBeVisible();
      await expect(
        sheet.getByText("Instructors", { exact: true }),
      ).toBeVisible();
      await expect(sheet.getByText("Prices", { exact: true })).toBeVisible();
      await expect(
        sheet.getByText("Field notes", { exact: true }),
      ).toBeVisible();
      await expect(
        sheet.getByText("Book a lesson", { exact: true }),
      ).toBeVisible();
      await expect(sheet.getByText("Sign in", { exact: true })).toBeVisible();
    });

    test("clicking a Sheet link closes the Sheet (Book a lesson)", async ({
      page,
    }) => {
      await setViewport(page, 375, 667);
      await page.goto("/en");

      await page.getByTestId("mobile-nav-trigger").click();
      const sheet = page.getByTestId("mobile-nav-sheet");
      await expect(sheet).toBeVisible();

      await sheet.getByText("Book a lesson", { exact: true }).click();
      await expect(page).toHaveURL(/\/en\/reservar/);
    });
  });

  test.describe("aria-label trilingual for hamburger trigger", () => {
    for (const locale of LOCALES) {
      test(`/${locale} hamburger has localised aria-label`, async ({ page }) => {
        await setViewport(page, 375, 667);
        await page.goto(`/${locale}`);
        const trigger = page.getByTestId("mobile-nav-trigger");
        const aria = await trigger.getAttribute("aria-label");
        expect(aria, `aria-label must be set for ${locale}`).toBeTruthy();
        expect(aria!.length).toBeGreaterThan(0);
      });
    }
  });

  test.describe("no horizontal overflow on key routes", () => {
    const routes = ["/en", "/de", "/es", "/en/login", "/en/reservar"];
    for (const vp of VIEWPORTS) {
      for (const route of routes) {
        test(`${route} @ ${vp.name} (${vp.width}×${vp.height}) — no overflow elements`, async ({
          page,
        }) => {
          await setViewport(page, vp.width, vp.height);
          await page.goto(route);
          // Wait for hero hydration on home; reservar shell on /reservar.
          await page.waitForLoadState("networkidle");
          const offenders = await rootHorizontalOverflow(page, vp.width);
          expect(
            offenders,
            `${route} at ${vp.name} has elements wider than viewport (overflow not clipped)`,
          ).toBe(0);
        });
      }
    }
  });
});
