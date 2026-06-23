import { test, expect } from "@playwright/test";

const LOCALES = ["en", "de", "es"] as const;

const HEADING = {
  en: "Questions, answered.",
  de: "Fragen, beantwortet.",
  es: "Preguntas, resueltas.",
} as const;

// First question + a stable fragment of its answer, per locale.
const FIRST_Q = {
  en: "Is the lift pass included?",
  de: "Ist das Skiticket inbegriffen?",
  es: "¿Está incluido el forfait?",
} as const;

const FIRST_A_FRAGMENT = {
  en: "you buy your own day pass",
  de: "die Tageskarte kaufst du selbst",
  es: "el forfait del día lo compras tú",
} as const;

test.describe("F-097 — FAQ page", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/faq renders and the accordion toggles via keyboard`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/faq`);

      await expect(page.getByTestId("faq-page")).toBeVisible();
      await expect(page.locator("h1")).toContainText(HEADING[locale]);

      const firstItem = page.getByTestId("faq-item-0");
      const trigger = firstItem.getByRole("button", { name: FIRST_Q[locale] });
      const answer = page.getByText(FIRST_A_FRAGMENT[locale]);

      // Starts collapsed.
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(answer).toBeHidden();

      // Keyboard: focus the trigger and toggle open with Enter.
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(answer).toBeVisible();

      // Enter again collapses it.
      await page.keyboard.press("Enter");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(answer).toBeHidden();
    });

    test(`/${locale}/faq emits valid FAQPage JSON-LD`, async ({ page }) => {
      await page.goto(`/${locale}/faq`);

      const raw = await page
        .locator('script[type="application/ld+json"]')
        .first()
        .textContent();
      expect(raw).toBeTruthy();

      const data = JSON.parse(raw!);
      expect(data["@type"]).toBe("FAQPage");
      expect(Array.isArray(data.mainEntity)).toBe(true);
      expect(data.mainEntity.length).toBe(12);

      for (const entry of data.mainEntity) {
        expect(entry["@type"]).toBe("Question");
        expect(typeof entry.name).toBe("string");
        expect(entry.name.length).toBeGreaterThan(0);
        expect(entry.acceptedAnswer["@type"]).toBe("Answer");
        expect(typeof entry.acceptedAnswer.text).toBe("string");
        expect(entry.acceptedAnswer.text.length).toBeGreaterThan(0);
      }

      // First question matches the rendered accordion — structured data and UI
      // share one source.
      expect(data.mainEntity[0].name).toBe(FIRST_Q[locale]);
    });

    test(`/${locale}/faq CTAs link to the funnel and pricing`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/faq`);
      await expect(page.getByTestId("faq-cta-book")).toHaveAttribute(
        "href",
        `/${locale}/reservar`,
      );
      await expect(page.getByTestId("faq-cta-prices")).toHaveAttribute(
        "href",
        `/${locale}/precios`,
      );
    });
  }

  test("nav Prices link points to the pricing page (F-093 wired up)", async ({
    page,
  }) => {
    await page.goto("/en");
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /prices/i })
      .first()
      .click();
    await page.waitForURL("**/precios");
    await expect(page.getByTestId("pricing-page")).toBeVisible();
  });
});
