import { z } from "zod";

import { isAllowedCtaHref } from "@/lib/hero-announcement";

// Shared Zod contract for the ad-banner admin UI (F-142). One schema drives both
// layers, like seasons (F-105): the React Hook Form resolver on the client and
// the `"use server"` wrappers in `app/(ops)/admin/actions.ts` (which re-validate
// before the dependency-injected cores in `lib/admin/announcements.ts`). There is
// no money/format conversion, so a single schema suffices.
//
// A banner is `body` (required in all three locales) plus an OPTIONAL CTA. The
// CTA is all-or-nothing: either no CTA at all, or an href (allow-listed) with a
// label in all three locales. `ctaLabel`/`ctaHref` are always present in the form
// (three text inputs + one href input) and may be empty; their required-ness is
// resolved in `superRefine`, and the core drops empties to `null`.

const localizedRequired = z.object({
  en: z.string().trim().min(1, "REQUIRED"),
  de: z.string().trim().min(1, "REQUIRED"),
  es: z.string().trim().min(1, "REQUIRED"),
});

export const announcementInputSchema = z
  .object({
    body: localizedRequired,
    enabled: z.boolean().optional().default(true),
    // CTA group — empty strings mean "no CTA".
    ctaLabel: z.object({
      en: z.string(),
      de: z.string(),
      es: z.string(),
    }),
    ctaHref: z.string().trim(),
  })
  .superRefine((val, ctx) => {
    const labelValues = [val.ctaLabel.en, val.ctaLabel.de, val.ctaLabel.es];
    const anyLabel = labelValues.some((s) => s.trim().length > 0);
    const hasHref = val.ctaHref.length > 0;
    // No CTA at all is fine.
    if (!anyLabel && !hasHref) return;

    // Partial CTA is not: an href needs a label in every locale, and vice versa.
    if (!hasHref) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CTA_HREF_REQUIRED",
        path: ["ctaHref"],
      });
    } else if (!isAllowedCtaHref(val.ctaHref)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CTA_HREF_INVALID",
        path: ["ctaHref"],
      });
    }
    for (const locale of ["en", "de", "es"] as const) {
      if (val.ctaLabel[locale].trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CTA_LABEL_REQUIRED",
          path: ["ctaLabel", locale],
        });
      }
    }
  });

// Public contract = the *input* type (pre-transform): `enabled` optional. The
// form + the `"use server"` wrappers build this shape; the cores `safeParse` it
// and consume `parsed.data` (enabled defaulted, strings trimmed).
export type AnnouncementInput = z.input<typeof announcementInputSchema>;
