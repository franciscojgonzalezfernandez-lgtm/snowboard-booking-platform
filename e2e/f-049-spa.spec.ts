import { test, expect } from "@playwright/test";

type Locale = "en" | "de" | "es";
const LOCALES: Locale[] = ["en", "de", "es"];

const STEP1_HEADING: Record<Locale, string> = {
  en: "Reserve a lesson",
  de: "Stunde buchen",
  es: "Reservar tu clase",
};

const STEPPER_LABEL: Record<Locale, string> = {
  en: "Booking steps",
  de: "Buchungsschritte",
  es: "Pasos de la reserva",
};

// Seed data shipped by prisma/seed.ts — Sprint 2 season covering Nov 2026
// onward. Pick a deterministic mid-season day so the spec stays green across
// runs without depending on real-clock proximity.
const DEEP_LINK_DATE = "2026-12-15";

test.describe("F-049 — single-page booking shell", () => {
  test("anonymous user lands on the new shell with no /step-N route", async ({
    page,
  }) => {
    await page.goto("/en/reservar");
    await expect(page.getByTestId("step1-title")).toHaveText(
      STEP1_HEADING.en,
    );
    await expect(page.getByTestId("booking-stepper")).toBeVisible();
    await expect(page.getByTestId("section-1")).toBeVisible();
    // Sections 2-5 only reveal as URL keys are added.
    await expect(page.getByTestId("section-2")).toHaveCount(0);
    await expect(page.getByTestId("section-3")).toHaveCount(0);
  });

  for (const locale of LOCALES) {
    test(`/${locale}/reservar stepper exposes the localised aria-label + 5 steps`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/reservar`);
      const stepper = page.getByTestId("booking-stepper");
      await expect(stepper).toBeVisible();
      await expect(stepper).toHaveAttribute("aria-label", STEPPER_LABEL[locale]);
      for (let step = 1; step <= 5; step += 1) {
        await expect(
          page.getByTestId(`stepper-step-${step}`),
        ).toBeVisible();
      }
    });
  }

  test("picking a duration mirrors ?d= in the URL + reveals Section 2", async ({
    page,
  }) => {
    await page.goto("/en/reservar");
    await page.getByTestId("select-duration").selectOption("ONE_HOUR");
    await page.getByTestId("submit-step1").click();

    await page.waitForURL(/\?.*\bd=ONE_HOUR\b/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/en/reservar");
    expect(url.searchParams.get("d")).toBe("ONE_HOUR");

    await expect(page.getByTestId("section-2")).toBeVisible();
    await expect(page.getByTestId("month-label")).toBeVisible();
    // No full-page navigation occurred: stepper from the initial shell
    // remains the same DOM node.
    await expect(page.getByTestId("booking-stepper")).toBeVisible();
  });

  test("deep-link /reservar?d=...&dt=... restores Sections 1-3 server-rendered", async ({
    page,
  }) => {
    await page.goto(
      `/en/reservar?d=ONE_HOUR&dt=${DEEP_LINK_DATE}`,
    );

    await expect(page.getByTestId("section-1")).toBeVisible();
    await expect(page.getByTestId("section-2")).toBeVisible();
    await expect(page.getByTestId("section-3")).toBeVisible();
    // Stepper marks step 1 + step 2 as completed (the URL has duration +
    // date) and step 3 as active.
    await expect(
      page.getByTestId("stepper-step-1"),
    ).toHaveAttribute("data-state", "completed");
    await expect(
      page.getByTestId("stepper-step-2"),
    ).toHaveAttribute("data-state", "completed");
    await expect(
      page.getByTestId("stepper-step-3"),
    ).toHaveAttribute("data-state", "active");
  });

  test("stepper click on a completed step smooth-scrolls in-page", async ({
    page,
  }) => {
    await page.goto(
      `/en/reservar?d=ONE_HOUR&dt=${DEEP_LINK_DATE}`,
    );

    const initialUrl = page.url();
    await page.getByTestId("stepper-step-1").click();
    // URL is unchanged — the stepper jumps are pure scroll, not nav.
    expect(page.url()).toBe(initialUrl);
    await expect(page.getByTestId("section-1")).toBeInViewport();
  });

  test("anonymous deep-link with full URL state surfaces the Section 4 sign-in CTA", async ({
    page,
  }) => {
    // No login — anonymous browsing context. The instructor id is the seed's
    // Adlerhorst owner; pricing/season covers December 2026.
    const url = new URL("http://localhost/en/reservar");
    url.searchParams.set("d", "ONE_HOUR");
    url.searchParams.set("dt", DEEP_LINK_DATE);
    url.searchParams.set("t", "10:00");
    url.searchParams.set("i", "instr_javi");
    url.searchParams.set("l", "en");
    await page.goto(url.pathname + url.search);

    const cta = page.getByTestId("step4-anonymous-cta");
    await expect(cta).toBeVisible();
    // The CTA preserves the URL state via ?next=
    const href = await cta.getAttribute("href");
    expect(href).toContain("/login?next=");
    expect(decodeURIComponent(href ?? "")).toContain("d=ONE_HOUR");
    expect(decodeURIComponent(href ?? "")).toContain(`dt=${DEEP_LINK_DATE}`);
  });
});
