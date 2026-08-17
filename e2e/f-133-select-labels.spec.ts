import { test, expect } from "@playwright/test";
import { signUpVerified } from "./helpers/auth";

/**
 * F-133 — a Select must show the item's label, never the raw enum value.
 *
 * Base UI's `Select.Value` renders the *value* unless the root is given the
 * value→label mapping, and the labels written inside `SelectItem` cannot cover
 * for it: the popup is portaled and unmounted once closed. So the funnel showed
 * `INTENSIVE` / `TWO_HOURS` to bookers in all three languages.
 *
 * The funnel specs all passed through this bug because they assert URL state
 * after selecting. These assert the **rendered text of the trigger**, which is
 * the thing a person actually looks at.
 */

const DURATIONS = ["ONE_HOUR", "TWO_HOURS", "INTENSIVE", "FULL_DAY"] as const;

// Any of these leaking into the UI means the mapping is gone again.
const RAW_VALUE = /^[A-Z][A-Z_]+$/u;

test.describe("F-133 — selects show labels, not enum values", () => {
  for (const locale of ["en", "de", "es"] as const) {
    test(`step 1 duration trigger shows a translated label (${locale})`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/reservar`);

      const trigger = page.getByTestId("select-duration");
      // Scope to the value slot: the trigger's text also contains the chevron.
      const value = trigger.locator('[data-slot="select-value"]');
      await trigger.click();

      const option = page.getByTestId("select-duration-INTENSIVE");
      const optionLabel = (await option.innerText()).trim();
      await option.click();

      const shown = (await value.innerText()).trim();

      expect(shown, "trigger fell back to the raw enum value").not.toMatch(
        RAW_VALUE,
      );
      expect(shown).not.toContain("INTENSIVE");
      // The trigger must agree with the option the visitor just clicked.
      expect(shown).toBe(optionLabel);
    });
  }

  test("every duration keeps label and value in agreement", async ({
    page,
  }) => {
    await page.goto("/en/reservar");
    const trigger = page.getByTestId("select-duration");
    const value = trigger.locator('[data-slot="select-value"]');

    for (const duration of DURATIONS) {
      await trigger.click();
      const option = page.getByTestId(`select-duration-${duration}`);
      const optionLabel = (await option.innerText()).trim();
      await option.click();

      await expect(value).toHaveText(optionLabel);
      expect(optionLabel).not.toMatch(RAW_VALUE);
    }

    // The value — not the label — is what reaches the URL on submit.
    await page.getByTestId("submit-step1").click();
    await expect(page).toHaveURL(/d=FULL_DAY/u);
  });

  test("step 4 rider level shows a label, not BEGINNER", async ({ page }) => {
    // The second half of the reported issue. Needs a verified session, since
    // Section 4's form only renders for a signed-in booker (F-122/F-128).
    await signUpVerified(
      page,
      `f133-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`,
      "F133 Tester",
    );

    await page.goto(
      `/en/reservar?${new URLSearchParams({
        d: "ONE_HOUR",
        dt: "2026-12-15",
        t: "10:00",
        i: "instr_javi",
        l: "en",
      })}`,
    );

    const trigger = page.getByTestId("attendee-0-level");
    await expect(trigger).toBeVisible();

    const value = trigger.locator('[data-slot="select-value"]');
    // Default state matters as much as the post-click one: the form seeds
    // BEGINNER, so the raw value was on screen before touching anything.
    await expect(value).not.toHaveText(RAW_VALUE);

    await trigger.click();
    const option = page.getByTestId("attendee-0-level-INTERMEDIATE");
    const optionLabel = (await option.innerText()).trim();
    await option.click();

    await expect(value).toHaveText(optionLabel);
    expect(optionLabel).not.toMatch(RAW_VALUE);
  });

  test("the placeholder still shows when nothing is selected", async ({
    page,
  }) => {
    await page.goto("/en/reservar");

    const shown = (
      await page
        .getByTestId("select-duration")
        .locator('[data-slot="select-value"]')
        .innerText()
    ).trim();

    expect(shown.length).toBeGreaterThan(0);
    expect(shown).not.toMatch(RAW_VALUE);
  });
});
