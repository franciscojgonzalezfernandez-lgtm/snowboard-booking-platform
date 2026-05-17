import { test, expect } from "@playwright/test";

type Locale = "en" | "de" | "es";

const STEP1_COPY: Record<Locale, {
  heading: string;
  durationLabel: string;
  languageLabel: string;
  cta: string;
  duration2h: string;
}> = {
  en: {
    heading: "Reserve a lesson",
    durationLabel: "Lesson length",
    languageLabel: "Instructor language",
    cta: "Continue",
    duration2h: "2 hours",
  },
  de: {
    heading: "Stunde buchen",
    durationLabel: "Stundenlänge",
    languageLabel: "Sprache des Lehrers",
    cta: "Weiter",
    duration2h: "2 Stunden",
  },
  es: {
    heading: "Reservar tu clase",
    durationLabel: "Duración de la clase",
    languageLabel: "Idioma del instructor",
    cta: "Continuar",
    duration2h: "2 horas",
  },
};

test.describe("F-025 — Step 1 filters", () => {
  for (const locale of ["en", "de", "es"] as const) {
    test(`/${locale}/reservar renders translated labels`, async ({ page }) => {
      const copy = STEP1_COPY[locale];
      await page.goto(`/${locale}/reservar`);

      await expect(page.getByTestId("step1-title")).toHaveText(copy.heading);
      await expect(page.getByText(copy.durationLabel, { exact: true })).toBeVisible();
      await expect(page.getByText(copy.languageLabel, { exact: true })).toBeVisible();
      await expect(page.getByTestId("submit-step1")).toHaveText(copy.cta);
    });

    test(`/${locale}/reservar preselects language = ${locale}`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/reservar`);
      await expect(page.getByTestId("select-language")).toHaveValue(locale);
    });
  }

  test("submitting without duration shows validation error and stays on /en/reservar", async ({
    page,
  }) => {
    await page.goto("/en/reservar");
    await page.getByTestId("submit-step1").click();

    await expect(
      page.getByText("Please pick a lesson length", { exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/en/reservar");
  });

  test("selecting duration + language and continuing navigates to /en/reservar/step-2 with query params", async ({
    page,
  }) => {
    await page.goto("/en/reservar");

    await page.getByTestId("select-duration").selectOption("TWO_HOURS");
    await page.getByTestId("select-language").selectOption("de");
    await page.getByTestId("submit-step1").click();

    await page.waitForURL(/\/en\/reservar\/step-2\?/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/en/reservar/step-2");
    expect(url.searchParams.get("duration")).toBe("TWO_HOURS");
    expect(url.searchParams.get("language")).toBe("de");

    await expect(page.getByTestId("step2-duration")).toHaveText("TWO_HOURS");
    await expect(page.getByTestId("step2-language")).toHaveText("de");
  });

  test("locale preserved across navigation: /de/reservar → /de/reservar/step-2", async ({
    page,
  }) => {
    await page.goto("/de/reservar");

    await page
      .getByTestId("select-duration")
      .selectOption("ONE_HOUR");
    await page.getByTestId("submit-step1").click();

    await page.waitForURL(/\/de\/reservar\/step-2\?/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/de/reservar/step-2");
    expect(url.searchParams.get("duration")).toBe("ONE_HOUR");
    expect(url.searchParams.get("language")).toBe("de");
  });
});
