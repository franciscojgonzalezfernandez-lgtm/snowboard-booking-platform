import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";

/**
 * Permanent regression net for the booking funnel.
 *
 * This spec is intentionally NOT tied to a ticket (no F-XXX prefix) — every
 * future PR that touches Step 1-5 of the reservation flow must keep these
 * tests green. The flow is the product; if it breaks, nothing else matters.
 *
 * What we guard against:
 * - The duration <Select> regressing into the uncontrolled→controlled mode
 *   switch that silently stops dispatching change events (F-050 incident).
 * - Any React / Base UI runtime warning during the funnel: those warnings
 *   are the canary that a primitive is being driven wrong and is about to
 *   stop working in production builds.
 * - SSR shell drift: a deep link with the full URL state must still render
 *   the Section 4 anonymous CTA so authenticated deep-links (post-magic-link
 *   roundtrip, share-back) keep working.
 */

// Deterministic seed date covered by Sprint 2 season (2026-11-15 → 2027-04-30).
const SEED_DATE = "2026-12-15";
const SEED_INSTRUCTOR = "instr_javi";

// Known noisy log sources that should not fail the run. Keep this list
// short and add justifications inline — every entry is debt.
const CONSOLE_IGNORE_PATTERNS: RegExp[] = [
  /\[Vercel Analytics\]/, // analytics bootstrap noise
  /\[Vercel Speed Insights\]/, // analytics bootstrap noise
  /Download the React DevTools/, // dev-only nag
];

// Patterns that MUST fail the run if seen — surfaced explicitly because
// they map to bug classes we have already paid for once.
const CONSOLE_FAIL_PATTERNS: RegExp[] = [
  /uncontrolled.*controlled/i, // React + Base UI controlled-state switch
  /controlled.*uncontrolled/i,
];

type ConsoleSink = {
  warnings: string[];
  errors: string[];
};

function attachConsoleSink(page: Page): ConsoleSink {
  const sink: ConsoleSink = { warnings: [], errors: [] };

  const isIgnored = (text: string) =>
    CONSOLE_IGNORE_PATTERNS.some((re) => re.test(text));

  const record = (kind: "warning" | "error", msg: ConsoleMessage) => {
    const text = msg.text();
    if (isIgnored(text)) return;
    if (kind === "warning") sink.warnings.push(text);
    else sink.errors.push(text);
  };

  page.on("console", (msg) => {
    if (msg.type() === "warning") record("warning", msg);
    if (msg.type() === "error") record("error", msg);
  });
  page.on("pageerror", (err) => {
    sink.errors.push(`pageerror: ${err.message}`);
  });

  return sink;
}

function assertConsoleClean(sink: ConsoleSink, context: string) {
  // Fail loud on the bug classes we explicitly hunt for.
  for (const pattern of CONSOLE_FAIL_PATTERNS) {
    const offender = [...sink.warnings, ...sink.errors].find((line) =>
      pattern.test(line),
    );
    if (offender) {
      throw new Error(
        `[${context}] forbidden console pattern matched ${pattern}: ${offender}`,
      );
    }
  }
  // Hard floor: zero React/Base UI runtime errors during the funnel.
  expect(sink.errors, `[${context}] console errors`).toEqual([]);
}

test.describe("Booking funnel — permanent regression net", () => {
  test("Step 1 → Step 2 via duration Select interaction (no controlled-state warning)", async ({
    page,
  }) => {
    const sink = attachConsoleSink(page);

    await page.goto("/en/reservar");
    await expect(page.getByTestId("step1-title")).toBeVisible();

    // Drive the shadcn Select exactly like a user would (open + pick item).
    // This is the path that broke under `value={field.value || undefined}`.
    await page.getByTestId("select-duration").click();
    await page.getByTestId("select-duration-ONE_HOUR").click();
    await page.getByTestId("submit-step1").click();

    await page.waitForURL(/\?.*\bd=ONE_HOUR\b/, { timeout: 5_000 });
    await expect(page.getByTestId("section-2")).toBeVisible();
    await expect(page.getByTestId("month-label")).toBeVisible();

    assertConsoleClean(sink, "Step1->Step2");
  });

  test("Deep link with d + dt restores Sections 1-3 server-rendered (anonymous)", async ({
    page,
  }) => {
    const sink = attachConsoleSink(page);
    await page.goto(`/en/reservar?d=ONE_HOUR&dt=${SEED_DATE}`);

    await expect(page.getByTestId("section-1")).toBeVisible();
    await expect(page.getByTestId("section-2")).toBeVisible();
    await expect(page.getByTestId("section-3")).toBeVisible();
    // Stepper reflects the URL state.
    await expect(page.getByTestId("stepper-step-1")).toHaveAttribute(
      "data-state",
      "completed",
    );
    await expect(page.getByTestId("stepper-step-2")).toHaveAttribute(
      "data-state",
      "completed",
    );
    await expect(page.getByTestId("stepper-step-3")).toHaveAttribute(
      "data-state",
      "active",
    );

    assertConsoleClean(sink, "DeepLink d+dt");
  });

  test("Deep link with full URL state surfaces the embedded Section 4 auth block", async ({
    page,
  }) => {
    const sink = attachConsoleSink(page);

    const url = new URL("http://localhost/en/reservar");
    url.searchParams.set("d", "ONE_HOUR");
    url.searchParams.set("dt", SEED_DATE);
    url.searchParams.set("t", "10:00");
    url.searchParams.set("i", SEED_INSTRUCTOR);
    url.searchParams.set("l", "en");
    await page.goto(url.pathname + url.search);

    // F-119: the anonymous Section 4 now embeds the auth methods in-page
    // (Google + magic link + email/password) instead of a CTA link to
    // /login. The draft stays in the URL, so no `?next=` hand-off is needed
    // for the on-page email/password path; Google/magic link carry it via
    // callbackURL. Assert the block renders and the /login link-out is gone.
    await expect(page.getByTestId("step4-auth")).toBeVisible();
    await expect(page.getByTestId("step4-auth-google")).toBeVisible();
    await expect(page.getByTestId("step4-auth-email")).toBeVisible();
    await expect(page.getByTestId("step4-auth-password")).toBeVisible();
    await expect(page.getByTestId("step4-auth-magic")).toBeVisible();
    await expect(page.getByTestId("step4-anonymous-cta")).toHaveCount(0);
    // The funnel URL is untouched — no redirect to /login.
    expect(new URL(page.url()).pathname).toBe("/en/reservar");

    assertConsoleClean(sink, "DeepLink Section4 auth block");
  });

  test("Re-entering Step 1 after picking a different duration keeps Select interactive", async ({
    page,
  }) => {
    const sink = attachConsoleSink(page);

    await page.goto("/en/reservar");

    await page.getByTestId("select-duration").click();
    await page.getByTestId("select-duration-ONE_HOUR").click();
    await page.getByTestId("submit-step1").click();
    await page.waitForURL(/\bd=ONE_HOUR\b/);

    // Re-open and change duration. This drives the Select from a defined
    // value back to a different defined value — the second touch hit the
    // dropped-events bug pre-fix because the controlled mode flipped on
    // the first selection.
    await page.getByTestId("select-duration").click();
    await page.getByTestId("select-duration-TWO_HOURS").click();
    await page.getByTestId("submit-step1").click();
    await page.waitForURL(/\bd=TWO_HOURS\b/);

    await expect(page.getByTestId("section-2")).toBeVisible();
    assertConsoleClean(sink, "Step1 re-pick");
  });
});
