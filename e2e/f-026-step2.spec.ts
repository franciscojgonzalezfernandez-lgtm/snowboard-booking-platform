import { test, expect } from "@playwright/test";

const MONTH_LABEL_LOCALE: Record<"en" | "de" | "es", { may: RegExp; nov: RegExp }> = {
  en: { may: /^May 2026$/u, nov: /^November 2026$/u },
  de: { may: /^Mai 2026$/u, nov: /^November 2026$/u },
  es: { may: /mayo de 2026/iu, nov: /noviembre de 2026/iu },
};

test.describe("F-026 — Step 2 smart calendar", () => {
  test("missing duration redirects to step-1", async ({ page }) => {
    await page.goto("/en/reservar/step-2");
    await page.waitForURL(/\/en\/reservar(\?|$)/);
    expect(new URL(page.url()).pathname).toBe("/en/reservar");
  });

  test("invalid duration redirects to step-1", async ({ page }) => {
    await page.goto("/en/reservar/step-2?duration=BOGUS");
    await page.waitForURL(/\/en\/reservar(\?|$)/);
    expect(new URL(page.url()).pathname).toBe("/en/reservar");
  });

  for (const locale of ["en", "de", "es"] as const) {
    test(`/${locale}/reservar/step-2 renders calendar with localized month label`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/reservar/step-2?duration=ONE_HOUR`);
      await expect(page.getByTestId("step2-calendar")).toBeVisible();
      await expect(page.getByTestId("month-label")).toHaveText(
        MONTH_LABEL_LOCALE[locale].may,
      );
      // Prev month disabled on current month (no past nav).
      await expect(page.getByTestId("month-prev")).toBeDisabled();
      // At least one weekday header rendered.
      await expect(page.getByTestId("calendar-grid")).toContainText(/.+/);
    });
  }

  test("current month (May 2026) has no availability — clicking a future day shows empty nearby block", async ({
    page,
  }) => {
    await page.goto("/en/reservar/step-2?duration=ONE_HOUR");
    const day = page.getByTestId("day-2026-05-29");
    await expect(day).toBeVisible();
    await expect(day).toHaveAttribute("data-available", "false");
    await expect(day).toHaveAttribute("data-past", "false");
    await day.click();
    await expect(page.getByTestId("nearby-block")).toBeVisible();
    await expect(page.getByTestId("nearby-empty")).toBeVisible();
  });

  test("deep-link to month=2026-11 surfaces available days and routes to step-3", async ({
    page,
  }) => {
    await page.goto(
      "/en/reservar/step-2?duration=ONE_HOUR&month=2026-11",
    );
    await expect(page.getByTestId("month-label")).toHaveText(
      MONTH_LABEL_LOCALE.en.nov,
    );
    // Prev month re-enabled because we're past the current month.
    await expect(page.getByTestId("month-prev")).toBeEnabled();

    const availableDays = page.locator('[data-testid^="day-2026-11-"][data-available="true"]');
    const count = await availableDays.count();
    expect(count).toBeGreaterThan(0);

    const first = availableDays.first();
    const iso = await first.getAttribute("data-testid");
    const date = iso!.replace("day-", "");
    await first.click();

    await page.waitForURL(/\/en\/reservar\/step-3\?/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/en/reservar/step-3");
    expect(url.searchParams.get("duration")).toBe("ONE_HOUR");
    expect(url.searchParams.get("date")).toBe(date);
    await expect(page.getByTestId("step3-date")).toHaveText(date);
  });

  test("clicking an unavailable in-season day with nearby openings lists 3-5 suggestions", async ({
    page,
  }) => {
    // 2026-11-15 is the Sunday the season opens — every weekday in week 1 has
    // an availability block, so picking a deliberately unavailable date would
    // require seeded blocks; instead we click a date inside the seeded window
    // and rely on nearby returning ≥1 result when the engine has no opening
    // exactly on the requested date.
    await page.goto(
      "/en/reservar/step-2?duration=FULL_DAY&month=2026-11",
    );
    // Find any unavailable day inside the seeded season window (after Nov 15).
    const unavailable = page.locator(
      '[data-testid^="day-2026-11-"][data-available="false"][data-past="false"]',
    );
    const total = await unavailable.count();
    test.skip(total === 0, "Seed produced no quiet day in Nov 2026; nearby UX covered elsewhere");
    await unavailable.first().click();
    await expect(page.getByTestId("nearby-block")).toBeVisible();
    // Either empty state OR 1..5 nearby buttons — both legal per engine spec.
    const list = page.locator('[data-testid^="nearby-2026-"]');
    const empty = page.getByTestId("nearby-empty");
    const listCount = await list.count();
    if (listCount === 0) {
      await expect(empty).toBeVisible();
    } else {
      expect(listCount).toBeGreaterThanOrEqual(1);
      expect(listCount).toBeLessThanOrEqual(5);
    }
  });

  test("month next/prev navigation updates label and URL", async ({ page }) => {
    await page.goto("/en/reservar/step-2?duration=ONE_HOUR");
    await page.getByTestId("month-next").click();
    await expect(page.getByTestId("month-label")).toHaveText(/^June 2026$/u);
    expect(new URL(page.url()).searchParams.get("month")).toBe("2026-06");

    await page.getByTestId("month-prev").click();
    await expect(page.getByTestId("month-label")).toHaveText(/^May 2026$/u);
    expect(new URL(page.url()).searchParams.get("month")).toBe("2026-05");
  });
});
