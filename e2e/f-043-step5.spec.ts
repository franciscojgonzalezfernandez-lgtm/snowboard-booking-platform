import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

type Locale = "en" | "de" | "es";

const LOCALES: Locale[] = ["en", "de", "es"];

const SEEDED_DATE = "2026-11-16"; // Monday within the seeded window (F-021)
const SEEDED_TIME = "11:00";

const SUMMARY_TITLE = {
  en: "Order summary",
  de: "Bestellübersicht",
  es: "Resumen del pedido",
} as const;

const PAY_PREFIX = {
  en: "Pay ",
  de: " bezahlen",
  es: "Pagar ",
} as const;

async function discoverInstructorId(request: APIRequestContext): Promise<string> {
  const res = await request.get("/api/availability/slots", {
    params: { duration: "ONE_HOUR", date: SEEDED_DATE },
  });
  const body = (await res.json()) as {
    anchorTimes: Array<{
      time: string;
      available: boolean;
      instructors: Array<{ id: string }>;
    }>;
  };
  const anchor = body.anchorTimes.find(
    (a) => a.time === SEEDED_TIME && a.available,
  );
  const instructor = anchor?.instructors[0];
  if (!instructor) {
    throw new Error(
      `No available instructor for ${SEEDED_DATE} ${SEEDED_TIME}; seed coverage drifted.`,
    );
  }
  return instructor.id;
}

function attendeesBase64(): string {
  const payload = JSON.stringify([
    { name: "F-043 Tester", age: 30, level: "INTERMEDIATE" },
  ]);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(payload, "utf8").toString("base64");
  }
  return btoa(payload);
}

function step5Path(locale: Locale, instructorId: string): string {
  const qs = new URLSearchParams({
    duration: "ONE_HOUR",
    date: SEEDED_DATE,
    time: SEEDED_TIME,
    instructor: instructorId,
    language: "en",
    bookerName: "F-043 Tester",
    bookerPhone: "+41766381870",
    notes: "",
    attendees: attendeesBase64(),
  });
  return `/${locale}/reservar/step-5?${qs.toString()}`;
}

function uniqueEmail() {
  return `f043-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: Page, email: string) {
  await page.goto("/en/login");
  await page.getByTestId("tab-signup").click();
  await page.getByTestId("input-name").fill("F-043 Tester");
  await page.getByTestId("input-email").fill(email);
  await page.getByTestId("input-password").fill("Sn0wb0ard!Strong");
  await page.getByTestId("submit-credentials").click();
  await page.waitForURL(/\/(en|de|es)\/?$/);
}

test.describe.skip("F-043 — Step 5 anonymous gating", () => {
  test("anonymous /en/reservar/step-5 redirects to /en/login with next= preserving the payload", async ({
    page,
    request,
  }) => {
    const instructorId = await discoverInstructorId(request);
    await page.goto(step5Path("en", instructorId));
    await page.waitForURL(/\/en\/login\?next=/u);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/en/login");
    const next = url.searchParams.get("next");
    expect(next).not.toBeNull();
    expect(next!.startsWith("/en/reservar/step-5")).toBe(true);
  });
});

test.describe.skip("F-043 — Step 5 mounts Payment Element for authenticated booker", () => {
  for (const locale of LOCALES) {
    test(`/${locale}/reservar/step-5 renders order summary and Pay button with translated label`, async ({
      page,
      request,
    }) => {
      const instructorId = await discoverInstructorId(request);
      await signUp(page, uniqueEmail());
      await page.goto(step5Path(locale, instructorId));

      await expect(page.getByTestId("step5-page")).toBeVisible();
      await expect(page.getByTestId("step5-summary")).toBeVisible();
      await expect(page.getByTestId("step5-summary")).toContainText(
        SUMMARY_TITLE[locale],
      );
      await expect(page.getByTestId("step5-summary-time")).toHaveText("11:00");
      await expect(page.getByTestId("step5-summary-attendees")).toContainText(
        "1",
      );

      const total = await page
        .getByTestId("step5-summary-total")
        .textContent();
      expect(total).toMatch(/CHF/);

      const payText = (await page.getByTestId("step5-pay").textContent()) ?? "";
      const expectedPrefix = PAY_PREFIX[locale];
      expect(payText.includes(expectedPrefix)).toBe(true);
    });
  }

  test("Stripe Payment Element iframe is mounted in the form", async ({
    page,
    request,
  }) => {
    const instructorId = await discoverInstructorId(request);
    await signUp(page, uniqueEmail());
    await page.goto(step5Path("en", instructorId));

    await expect(page.getByTestId("step5-form")).toBeVisible();
    // Stripe.js injects iframes for the Payment Element. Wait for at least one
    // iframe inside the form to confirm Elements actually mounted.
    const iframe = page
      .locator('[data-testid="step5-form"] iframe')
      .first();
    await expect(iframe).toBeVisible({ timeout: 15000 });
  });
});

test.describe.skip("F-043 — Step 5 invalid payload", () => {
  test("missing required params shows the INVALID error panel pointing back to Step 4", async ({
    page,
  }) => {
    await signUp(page, uniqueEmail());
    // No `attendees` param → INVALID branch.
    await page.goto(
      `/en/reservar/step-5?duration=ONE_HOUR&date=2026-12-05&time=11:00&instructor=bogus&language=en&bookerName=Tester&bookerPhone=%2B41766381870`,
    );
    await expect(page.getByTestId("step5-error-invalid")).toBeVisible();
  });
});
