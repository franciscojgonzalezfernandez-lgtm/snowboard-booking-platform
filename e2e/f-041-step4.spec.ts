import { test, expect, type Page } from "@playwright/test";

type Locale = "en" | "de" | "es";

const ANON_HEADING = {
  en: "Sign in to continue",
  de: "Zum Fortfahren anmelden",
  es: "Inicia sesión para continuar",
} as const;

const LOCALES: Locale[] = ["en", "de", "es"];

const STEP4_PARAMS = {
  duration: "ONE_HOUR",
  date: "2026-12-05",
  time: "11:00",
  instructor: "instr_javi",
  language: "en",
} as const;

function step4Path(locale: Locale): string {
  const qs = new URLSearchParams(STEP4_PARAMS).toString();
  return `/${locale}/reservar/step-4?${qs}`;
}

function uniqueEmail() {
  return `f041-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, email: string, name: string) {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill(name);
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
  await page.getByTestId("submit-credentials").click();
  await page.waitForURL(/\/(en|de|es)\/?$/);
}

test.describe("F-041 — Step 4 auth gate", () => {
  for (const locale of LOCALES) {
    test(`anonymous /${locale}/reservar/step-4 renders the localised CTA with a next= preserving search params`, async ({
      page,
    }) => {
      await page.goto(step4Path(locale));

      await expect(page.getByTestId("step4-anonymous-heading")).toHaveText(
        ANON_HEADING[locale],
      );

      const cta = page.getByTestId("step4-anonymous-cta");
      const href = await cta.getAttribute("href");
      expect(href, "CTA href must be set").not.toBeNull();
      const url = new URL(href!, "http://localhost");
      expect(url.pathname).toBe(`/${locale}/login`);
      const next = url.searchParams.get("next");
      expect(next, "next= must be set").not.toBeNull();
      expect(next!.startsWith(`/${locale}/reservar/step-4`)).toBe(true);
      const decodedNext = new URL(next!, "http://localhost");
      for (const [key, value] of Object.entries(STEP4_PARAMS)) {
        expect(decodedNext.searchParams.get(key)).toBe(value);
      }
    });
  }
});

test.describe("F-041 — Step 4 form (authenticated)", () => {
  test("renders the form prefilled with the session booker, and submit forwards to step-5", async ({
    page,
  }) => {
    const email = uniqueEmail();
    const name = "F041 Tester";
    await signUp(page, email, name);

    await page.goto(step4Path("en"));

    await expect(page.getByTestId("step4-form")).toBeVisible();
    await expect(page.getByTestId("booker-name")).toHaveValue(name);
    await expect(page.getByTestId("booker-email")).toHaveValue(email);
    await expect(page.getByTestId("booker-email")).toHaveAttribute(
      "readonly",
      "",
    );

    await expect(page.getByTestId("step4-submit")).toBeDisabled();

    await page.getByTestId("booker-phone").fill("+41 76 638 1870");
    await page.getByTestId("attendee-0-name").fill("Lara");
    await page.getByTestId("attendee-0-age").fill("12");

    await expect(page.getByTestId("step4-submit")).toBeDisabled();

    await page.getByTestId("terms-checkbox").click();
    await expect(page.getByTestId("step4-submit")).toBeEnabled();

    await page.getByTestId("step4-submit").click();
    await page.waitForURL(/\/en\/reservar\/step-5\?/);

    const target = new URL(page.url());
    expect(target.searchParams.get("duration")).toBe(STEP4_PARAMS.duration);
    expect(target.searchParams.get("date")).toBe(STEP4_PARAMS.date);
    expect(target.searchParams.get("time")).toBe(STEP4_PARAMS.time);
    expect(target.searchParams.get("instructor")).toBe(STEP4_PARAMS.instructor);
    expect(target.searchParams.get("language")).toBe(STEP4_PARAMS.language);
    expect(target.searchParams.get("bookerName")).toBe(name);
    expect(target.searchParams.get("bookerPhone")).toBe("+41766381870");
    expect(target.searchParams.get("attendees")).not.toBeNull();
  });

  test("attendees array enforces min 1 / max 4 via Add and Remove controls", async ({
    page,
  }) => {
    const email = uniqueEmail();
    await signUp(page, email, "Bounds Tester");
    await page.goto(step4Path("en"));

    await expect(page.getByTestId("attendee-0-remove")).toHaveCount(0);

    await page.getByTestId("attendee-add").click();
    await page.getByTestId("attendee-add").click();
    await page.getByTestId("attendee-add").click();

    await expect(page.getByTestId("attendee-1")).toBeVisible();
    await expect(page.getByTestId("attendee-2")).toBeVisible();
    await expect(page.getByTestId("attendee-3")).toBeVisible();

    await expect(page.getByTestId("attendee-add")).toBeDisabled();
    await expect(page.getByTestId("attendee-0-remove")).toBeVisible();

    await page.getByTestId("attendee-3-remove").click();
    await expect(page.getByTestId("attendee-3")).toHaveCount(0);
    await expect(page.getByTestId("attendee-add")).toBeEnabled();
  });

  test("opens Terms modal from the checkbox label", async ({ page }) => {
    const email = uniqueEmail();
    await signUp(page, email, "Modal Tester");
    await page.goto(step4Path("en"));

    await page.getByTestId("terms-modal-trigger").first().click();
    await expect(page.getByTestId("terms-modal")).toBeVisible();
  });
});
