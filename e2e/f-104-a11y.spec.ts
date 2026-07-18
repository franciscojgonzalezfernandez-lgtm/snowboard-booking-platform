import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// F-104 — automated WCAG 2.1 A/AA audit of the Sprint 5 marketing surfaces.
// Runs axe-core on every public marketing route × 3 locales and fails on any
// critical/serious violation. moderate/minor are logged (attached) but do not
// fail the launch gate — they roll into the Sprint 6 product-wide WCAG sweep.

const LOCALES = ["en", "de", "es"] as const;

// Translated slugs (F-102). "" = the locale home.
const ROUTES: { name: string; slug: Record<(typeof LOCALES)[number], string> }[] =
  [
    { name: "home", slug: { en: "", de: "", es: "" } },
    { name: "pricing", slug: { en: "pricing", de: "preise", es: "precios" } },
    {
      name: "instructors",
      slug: { en: "instructors", de: "instruktoren", es: "instructores" },
    },
    { name: "about", slug: { en: "about", de: "ueber-uns", es: "sobre" } },
    { name: "contact", slug: { en: "contact", de: "kontakt", es: "contacto" } },
    { name: "faq", slug: { en: "faq", de: "faq", es: "faq" } },
    { name: "blog", slug: { en: "blog", de: "blog", es: "blog" } },
  ];

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING = new Set(["critical", "serious"]);

for (const route of ROUTES) {
  for (const locale of LOCALES) {
    const path = route.slug[locale]
      ? `/${locale}/${route.slug[locale]}`
      : `/${locale}`;

    test(`a11y: ${route.name} [${locale}] (${path})`, async ({ page }, testInfo) => {
      await page.goto(path, { waitUntil: "networkidle" });

      // F-118: Lighthouse flags `landmark-one-main` (Document has no main
      // landmark). It's an axe best-practice rule — outside the WCAG tags
      // below — so the axe gate never caught it; the home was shipping a bare
      // fragment. Assert exactly one <main> per route so it can't regress the
      // Lighthouse a11y score again.
      expect(
        await page.locator("main").count(),
        `expected exactly one <main> landmark on ${path}`,
      ).toBe(1);

      const results = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact && BLOCKING.has(v.impact),
      );

      // Attach the full violation set for triage (visible in the HTML report).
      await testInfo.attach(`axe-${route.name}-${locale}.json`, {
        body: JSON.stringify(
          results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.map((n) => n.target),
          })),
          null,
          2,
        ),
        contentType: "application/json",
      });

      expect(
        blocking,
        `critical/serious a11y violations on ${path}:\n` +
          blocking
            .map((v) => `  [${v.impact}] ${v.id} — ${v.help}`)
            .join("\n"),
      ).toEqual([]);
    });
  }
}
