import { SITE_URL } from "@/lib/seo/site-url";

// Serves /llms.txt — the llmstxt.org guide file for LLM crawlers and agents: a
// small, curated map of the site in markdown so a model can find the canonical
// pages without scraping. NOT a Google ranking signal (that is F-099 sitemap +
// robots); this is a courtesy surface for AI agents. Points at the English URLs
// as the canonical reference; /de and /es mirror them via translated slugs
// (F-102). Low-churn, maintained by hand alongside the marketing routes.
//
// Route segment folder literally named "llms.txt" → served at /llms.txt, same
// mechanism Next uses to let a folder carry a dotted public path.
export const dynamic = "force-static";

const BODY = `# Ride Flumserberg

> Private snowboard lessons in Flumserberg, Switzerland — one certified instructor, beginners to advanced, kids and adults, taught in English, German and Spanish.

Ride Flumserberg is a single-instructor snowboard school on the Flumserberg ski area (Tannenbodenalp, canton of St. Gallen). Lessons are booked online and run as 1, 2, 4 or 6-hour private sessions through the winter season. The site is trilingual; the English URLs below are canonical — /de and /es mirror them with translated slugs.

## Main pages

- [Home](${SITE_URL}/en): who teaches, the classes, and why Flumserberg.
- [Prices](${SITE_URL}/en/pricing): the four lesson durations and what each is best for, priced in CHF.
- [Instructors](${SITE_URL}/en/instructors): the instructor profiles — languages spoken and what they love riding.
- [About](${SITE_URL}/en/about): the story behind the school and the teaching philosophy.
- [Contact](${SITE_URL}/en/contact): phone, email, meeting point and season.
- [FAQ](${SITE_URL}/en/faq): lift pass, gear, age limits, languages, cancellation and what to bring.
- [Field notes](${SITE_URL}/en/blog): short posts on learning to snowboard in Flumserberg.

## Booking

- [Book a lesson](${SITE_URL}/en/reservar): pick a duration and date, then pay to confirm.

## Legal

- [Terms and Conditions](${SITE_URL}/en/terms)
- [Privacy Policy](${SITE_URL}/en/privacy)

## Notes

- Trilingual: /de/... and /es/... mirror the pages above with translated slugs.
- The booking funnel, student dashboard, instructor and admin areas are authenticated app surfaces, not indexed content.
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
