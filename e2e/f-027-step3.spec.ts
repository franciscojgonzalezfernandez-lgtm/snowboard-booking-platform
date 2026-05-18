import { test, expect, type Page } from "@playwright/test";

const SEEDED_DATE = "2026-11-16"; // Monday inside the seeded Nov-2026 window
const HEADING_LOCALE = {
  en: /Pick a time and instructor/iu,
  de: /Wähle Zeit und Coach/iu,
  es: /Elige hora y monitor/iu,
} as const;

async function gotoStep3(
  page: Page,
  locale: "en" | "de" | "es" = "en",
  query: Record<string, string> = { duration: "ONE_HOUR", date: SEEDED_DATE },
) {
  const qs = new URLSearchParams(query).toString();
  await page.goto(`/${locale}/reservar/step-3${qs ? `?${qs}` : ""}`);
}

test.describe("F-027 — Step 3 anchor time + instructor + language", () => {
  test("missing duration redirects to step-1", async ({ page }) => {
    await gotoStep3(page, "en", { date: SEEDED_DATE });
    await page.waitForURL(/\/en\/reservar(\?|$)/);
    expect(new URL(page.url()).pathname).toBe("/en/reservar");
  });

  test("invalid duration redirects to step-1", async ({ page }) => {
    await gotoStep3(page, "en", { duration: "BOGUS", date: SEEDED_DATE });
    await page.waitForURL(/\/en\/reservar(\?|$)/);
    expect(new URL(page.url()).pathname).toBe("/en/reservar");
  });

  test("missing date redirects to step-2 keeping duration", async ({
    page,
  }) => {
    await gotoStep3(page, "en", { duration: "ONE_HOUR" });
    await page.waitForURL(/\/en\/reservar\/step-2/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/en/reservar/step-2");
    expect(url.searchParams.get("duration")).toBe("ONE_HOUR");
  });

  test("invalid date redirects to step-2 keeping duration", async ({
    page,
  }) => {
    await gotoStep3(page, "en", {
      duration: "ONE_HOUR",
      date: "not-a-date",
    });
    await page.waitForURL(/\/en\/reservar\/step-2/);
    expect(new URL(page.url()).pathname).toBe("/en/reservar/step-2");
  });

  for (const locale of ["en", "de", "es"] as const) {
    test(`/${locale}/reservar/step-3 renders heading and anchor list`, async ({
      page,
    }) => {
      await gotoStep3(page, locale);
      await expect(page.getByTestId("step3-title")).toHaveText(
        HEADING_LOCALE[locale],
      );
      await expect(page.getByTestId("anchor-list")).toBeVisible();
      // All 4 seeded anchors render.
      for (const time of ["09:00", "11:00", "13:00", "15:00"]) {
        await expect(page.getByTestId(`anchor-${time}`)).toBeVisible();
      }
    });
  }

  test("selecting an anchor reveals the instructor section with anyone preselected", async ({
    page,
  }) => {
    await gotoStep3(page);
    const anchor = page.getByTestId("anchor-09:00");
    await expect(anchor).toHaveAttribute("data-available", "true");
    await anchor.click();

    await expect(page.getByTestId("instructor-section")).toBeVisible();
    await expect(page.getByTestId("instructor-anyone")).toHaveAttribute(
      "data-selected",
      "true",
    );

    // URL syncs time + instructor=ANYONE + default language.
    const url = new URL(page.url());
    expect(url.searchParams.get("time")).toBe("09:00");
    expect(url.searchParams.get("instructor")).toBe("ANYONE");
    expect(url.searchParams.get("language")).toBe("en");
  });

  test("multi-language instructor exposes language pills with primary selected", async ({
    page,
  }) => {
    await gotoStep3(page);
    await page.getByTestId("anchor-09:00").click();

    await expect(page.getByTestId("language-section")).toBeVisible();
    // Seed instructor speaks en, de, es.
    await expect(page.getByTestId("language-en")).toBeVisible();
    await expect(page.getByTestId("language-de")).toBeVisible();
    await expect(page.getByTestId("language-es")).toBeVisible();
    await expect(page.getByTestId("language-en")).toHaveAttribute(
      "data-selected",
      "true",
    );

    await page.getByTestId("language-de").click();
    await expect(page.getByTestId("language-de")).toHaveAttribute(
      "data-selected",
      "true",
    );
    expect(new URL(page.url()).searchParams.get("language")).toBe("de");
  });

  test("picking a named instructor updates URL state and persists across refresh", async ({
    page,
  }) => {
    await gotoStep3(page);
    await page.getByTestId("anchor-09:00").click();

    // Find the first named instructor card (button only — skip the section div
    // and the ANYONE row).
    const card = page
      .locator(
        'button[data-testid^="instructor-"]:not([data-testid="instructor-anyone"])',
      )
      .first();
    const id = (await card.getAttribute("data-testid"))!.replace(
      "instructor-",
      "",
    );
    await card.click();
    await expect(card).toHaveAttribute("data-selected", "true");
    expect(new URL(page.url()).searchParams.get("instructor")).toBe(id);

    await page.reload();
    await expect(
      page.getByTestId(`instructor-${id}`),
    ).toHaveAttribute("data-selected", "true");
  });

  test("continue navigates to step-4 with full URL state", async ({
    page,
  }) => {
    await gotoStep3(page);
    await page.getByTestId("anchor-11:00").click();
    await page.getByTestId("language-es").click();
    await page.getByTestId("step3-continue").click();

    await page.waitForURL(/\/en\/reservar\/step-4\?/u);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/en/reservar/step-4");
    expect(url.searchParams.get("duration")).toBe("ONE_HOUR");
    expect(url.searchParams.get("date")).toBe(SEEDED_DATE);
    expect(url.searchParams.get("time")).toBe("11:00");
    expect(url.searchParams.get("language")).toBe("es");
    // ANYONE resolves to the assigned instructor id on continue.
    const instructorParam = url.searchParams.get("instructor");
    expect(instructorParam).not.toBeNull();
    expect(instructorParam).not.toBe("ANYONE");

    await expect(page.getByTestId("step4-time")).toHaveText("11:00");
    await expect(page.getByTestId("step4-language")).toHaveText("es");
  });

  test("instructor cards render a photo for Javi and an initials fallback for Lara", async ({
    page,
  }) => {
    await gotoStep3(page);
    // 11:00 on a Monday in the seeded window: both Javi (photo) and
    // Lara (photo = null per F-036 seed) are candidates.
    await page.getByTestId("anchor-11:00").click();

    // Anyone-row avatar is mounted as soon as an anchor is picked.
    const anyoneCard = page.getByTestId("instructor-anyone");
    const anyoneAvatar = anyoneCard.locator(
      '[data-testid="instructor-photo"], [data-testid="instructor-photo-fallback"]',
    );
    await expect(anyoneAvatar.first()).toBeVisible();

    // At least one named card shows a real photo (Javi's headshot).
    const photos = page.locator(
      'button[data-testid^="instructor-"]:not([data-testid="instructor-anyone"]) [data-testid="instructor-photo"]',
    );
    expect(await photos.count()).toBeGreaterThan(0);

    // At least one named card falls back to initials (Lara, photo = null).
    const fallbacks = page.locator(
      'button[data-testid^="instructor-"]:not([data-testid="instructor-anyone"]) [data-testid="instructor-photo-fallback"]',
    );
    expect(await fallbacks.count()).toBeGreaterThan(0);
    // Initials are uppercase letters from the instructor name.
    await expect(fallbacks.first()).toHaveText(/^[A-ZÄÖÜ]{1,2}$/u);
  });
});
