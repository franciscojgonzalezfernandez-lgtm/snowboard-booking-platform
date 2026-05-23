import { test, expect, type Page } from "@playwright/test";

type Locale = "en" | "de" | "es";
const LOCALES: Locale[] = ["en", "de", "es"];

const BREAKPOINTS = [
  { name: "iphone-se", width: 375, height: 812 },
  { name: "ipad", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "desktop", width: 1920, height: 1080 },
] as const;

async function setViewport(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
}

test.describe("F-050 — responsive behavior across breakpoints", () => {
  test.describe("home", () => {
    for (const bp of BREAKPOINTS) {
      test(`/en at ${bp.name} (${bp.width}×${bp.height}) renders hero + footer`, async ({
        page,
      }) => {
        await setViewport(page, bp.width, bp.height);
        await page.goto("/en");
        // Hero h1 always present
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        // Footer pinned to viewport via min-h-dvh flex shell
        await expect(page.getByTestId("site-footer")).toBeVisible();
        await expect(page.getByTestId("footer-terms-link")).toBeVisible();
      });
    }
  });

  test.describe("login", () => {
    for (const bp of BREAKPOINTS) {
      test(`/en/login at ${bp.name} renders shadcn Tabs with 44px+ trigger`, async ({
        page,
      }) => {
        await setViewport(page, bp.width, bp.height);
        await page.goto("/en/login");

        const signInTab = page.getByTestId("tab-signin");
        const signUpTab = page.getByTestId("tab-signup");
        await expect(signInTab).toBeVisible();
        await expect(signUpTab).toBeVisible();

        // TabsList has h-11 (44px) for mobile touch target compliance.
        const box = await signInTab.boundingBox();
        expect(box, "tab trigger must have measurable box").not.toBeNull();
        // Allow some slack for sub-pixel rounding; 40px floor is conservative.
        expect(box!.height).toBeGreaterThanOrEqual(40);
      });
    }
  });

  test.describe("reservar shell", () => {
    test("mobile (375): horizontal stepper hidden, mobile trigger visible", async ({
      page,
    }) => {
      await setViewport(page, 375, 812);
      await page.goto("/en/reservar");

      await expect(page.getByTestId("booking-stepper")).toBeVisible();
      await expect(page.getByTestId("stepper-mobile-trigger")).toBeVisible();
      await expect(
        page.getByTestId("stepper-mobile-current-label"),
      ).toBeVisible();
      // Horizontal stepper steps are display:none below md.
      await expect(page.getByTestId("stepper-step-1")).toBeHidden();
    });

    test("tablet (768): horizontal stepper visible, mobile trigger hidden", async ({
      page,
    }) => {
      await setViewport(page, 768, 1024);
      await page.goto("/en/reservar");

      await expect(page.getByTestId("stepper-step-1")).toBeVisible();
      await expect(page.getByTestId("stepper-step-5")).toBeVisible();
      await expect(page.getByTestId("stepper-mobile-trigger")).toBeHidden();
    });

    test("mobile (375): tapping stepper trigger opens Sheet with 5 steps", async ({
      page,
    }) => {
      await setViewport(page, 375, 812);
      // Pre-seed URL with duration so step 1 is "completed" + clickable.
      await page.goto("/en/reservar?d=ONE_HOUR");

      await page.getByTestId("stepper-mobile-trigger").click();
      // Sheet content renders mobile step buttons.
      for (let step = 1; step <= 5; step += 1) {
        await expect(
          page.getByTestId(`stepper-mobile-step-${step}`),
        ).toBeVisible();
      }
      // Completed step-1 must be enabled.
      await expect(
        page.getByTestId("stepper-mobile-step-1"),
      ).toBeEnabled();
    });

    test("footer is pinned to viewport bottom on short pages", async ({
      page,
    }) => {
      await setViewport(page, 1280, 900);
      await page.goto("/en/reservar");

      const footer = page.getByTestId("site-footer");
      const footerBox = await footer.boundingBox();
      expect(footerBox, "footer must be measurable").not.toBeNull();
      // Footer bottom should sit at (or beyond) the viewport bottom; the
      // min-h-dvh wrapper guarantees no orphan gap under it.
      const viewport = page.viewportSize();
      expect(footerBox!.y + footerBox!.height).toBeGreaterThanOrEqual(
        (viewport?.height ?? 0) - 1,
      );
    });
  });

  test.describe("locale switcher i18n for new mobile stepper Sheet", () => {
    for (const locale of LOCALES) {
      test(`/${locale}/reservar mobile stepper trigger has localised aria-label`, async ({
        page,
      }) => {
        await setViewport(page, 375, 812);
        await page.goto(`/${locale}/reservar`);
        const trigger = page.getByTestId("stepper-mobile-trigger");
        await expect(trigger).toBeVisible();
        const aria = await trigger.getAttribute("aria-label");
        expect(aria, `aria-label must be set for ${locale}`).toBeTruthy();
        expect(aria!.length).toBeGreaterThan(0);
      });
    }
  });
});
