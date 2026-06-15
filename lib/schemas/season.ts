import { z } from "zod";

// Shared Zod contract for the season management admin UI (F-105). One schema
// drives both layers: the React Hook Form resolver on the client and the
// `"use server"` wrappers in `app/admin/actions.ts` (which re-validate before
// the dependency-injected cores in `lib/admin/seasons.ts` run). Unlike pricing
// (F-080) there is no money conversion, so a single schema suffices.
//
// `Season` (F-020) already has every column; this ticket is pure UI + actions.
// `priceCentsByDuration` is NOT set here — a new season starts `{}` and the
// owner populates it in `/admin/pricing` (F-080) before activating.

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const hhmm = z.string().regex(HHMM, "INVALID_TIME");

/** "HH:MM" → minutes since midnight, for ordering/range checks. */
function toMinutes(value: string): number {
  const [h = "0", m = "0"] = value.split(":");
  return Number(h) * 60 + Number(m);
}

export const seasonInputSchema = z
  .object({
    name: z.string().trim().min(1, "REQUIRED").max(120, "TOO_LONG"),
    startDate: z.string().regex(ISO_DATE, "INVALID_DATE"),
    endDate: z.string().regex(ISO_DATE, "INVALID_DATE"),
    // Sort + dedup in the transform so the engine always sees a canonical list
    // and the "anchor within ops range" check below runs on clean values.
    anchorTimes: z
      .array(hhmm)
      .min(1, "NO_ANCHORS")
      .transform((arr) => Array.from(new Set(arr)).sort()),
    operatingHoursStart: hhmm,
    operatingHoursEnd: hhmm,
    // Activation is a separate gated action (`activateSeason` enforces the
    // single-active + complete-pricing invariants). Accepted here for schema
    // fidelity but never honoured on create/update — a new season is inactive.
    active: z.boolean().optional().default(false),
  })
  .superRefine((val, ctx) => {
    // ISO `YYYY-MM-DD` strings order lexicographically, so a string compare is
    // a correct date compare here.
    if (val.startDate >= val.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DATE_ORDER",
        path: ["endDate"],
      });
    }
    const opStart = toMinutes(val.operatingHoursStart);
    const opEnd = toMinutes(val.operatingHoursEnd);
    if (opStart >= opEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OPS_ORDER",
        path: ["operatingHoursEnd"],
      });
    }
    for (const anchor of val.anchorTimes) {
      const m = toMinutes(anchor);
      if (m < opStart || m > opEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ANCHOR_OUT_OF_OPS",
          path: ["anchorTimes"],
        });
        break;
      }
    }
  });

// Public contract = the *input* type (pre-transform): `active` optional,
// anchorTimes any "HH:MM"[]. Callers (the form + the `"use server"` wrappers)
// build this shape; the cores `safeParse` it and consume the canonical output
// (`parsed.data`: active defaulted, anchorTimes sorted/deduped).
export type SeasonInput = z.input<typeof seasonInputSchema>;
