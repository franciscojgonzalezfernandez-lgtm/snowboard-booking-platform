import { z } from "zod";

// Shared Zod contract for the admin discount-code editor (F-155). Two layers,
// mirroring the pricing editor (F-080):
//
//  - `discountCodeInputSchema` is the *authoritative* server contract: a code
//    carries EITHER `percentOff` (1..100) OR `amountOffCents` (positive integer
//    cents), never both and never neither. The dependency-injected core in
//    `lib/admin/discount-codes.ts` and the `"use server"` wrapper both validate
//    against it. `.int()` on the cents keeps money integer (CLAUDE.md).
//
//  - `discountCodeFormSchema` is the *client* contract for React Hook Form: the
//    owner picks a type (percent / amount), types the amount in CHF francs, and
//    the form converts francs → cents via `lib/pricing/chf.ts` before calling
//    the action, which re-validates in cents.
//
// Codes are stored UPPERCASE (matched case-insensitively against the booker's
// input) and restricted to letters/digits/hyphen so "Vergani" and "VERGANI"
// are the same code.

// 10'000 CHF defensive ceiling on a fixed discount — far above any real lesson
// price; blocks a fat-finger with extra zeros (same ceiling as pricing).
const MAX_AMOUNT_OFF_CENTS = 1_000_000;
// Sanity ceiling on the optional global redemption cap.
const MAX_REDEMPTIONS = 1_000_000;

const CODE_CHARS = /^[A-Z0-9-]+$/;

// ---------------------------------------------------------------------------
// Server contract (cents)
// ---------------------------------------------------------------------------

export const discountCodeInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "TOO_SHORT")
      .max(40, "TOO_LONG")
      .transform((s) => s.toUpperCase())
      .pipe(z.string().regex(CODE_CHARS, "INVALID_CHARS")),
    // Optional internal note. Empty string collapses to undefined so the column
    // stores null rather than "".
    label: z
      .string()
      .trim()
      .max(120, "TOO_LONG")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    percentOff: z.number().int("NOT_INTEGER").min(1, "OUT_OF_RANGE").max(100, "OUT_OF_RANGE").optional(),
    amountOffCents: z
      .number()
      .int("NOT_INTEGER")
      .positive("NOT_POSITIVE")
      .max(MAX_AMOUNT_OFF_CENTS, "TOO_LARGE")
      .optional(),
    maxRedemptions: z
      .number()
      .int("NOT_INTEGER")
      .positive("NOT_POSITIVE")
      .max(MAX_REDEMPTIONS, "TOO_LARGE")
      .optional(),
    active: z.boolean().optional().default(true),
  })
  .superRefine((v, ctx) => {
    const hasPercent = v.percentOff != null;
    const hasAmount = v.amountOffCents != null;
    // Exactly one of the two discount kinds.
    if (hasPercent === hasAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["percentOff"],
        message: "NEED_EXACTLY_ONE_DISCOUNT",
      });
    }
  });

export type DiscountCodeInput = z.input<typeof discountCodeInputSchema>;

// ---------------------------------------------------------------------------
// Client contract (francs + a type discriminator)
// ---------------------------------------------------------------------------

export const discountCodeFormSchema = z
  .object({
    code: z.string().trim().min(2, "TOO_SHORT").max(40, "TOO_LONG"),
    label: z.string().trim().max(120, "TOO_LONG"),
    discountType: z.enum(["percent", "amount"]),
    // Only the field matching `discountType` is required — enforced below.
    percentOff: z.number().optional(),
    amountFrancs: z.number().optional(),
    // Blank (NaN → undefined via setValueAs) = unlimited.
    maxRedemptions: z.number().optional(),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (!CODE_CHARS.test(v.code.toUpperCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["code"],
        message: "INVALID_CHARS",
      });
    }
    if (v.discountType === "percent") {
      if (
        v.percentOff == null ||
        !Number.isInteger(v.percentOff) ||
        v.percentOff < 1 ||
        v.percentOff > 100
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["percentOff"],
          message: "PERCENT_RANGE",
        });
      }
    } else {
      if (v.amountFrancs == null || !(v.amountFrancs > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amountFrancs"],
          message: "AMOUNT_POSITIVE",
        });
      }
    }
    if (
      v.maxRedemptions != null &&
      (!Number.isInteger(v.maxRedemptions) || v.maxRedemptions < 1)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxRedemptions"],
        message: "MAX_REDEMPTIONS_RANGE",
      });
    }
  });

export type DiscountCodeFormInput = z.infer<typeof discountCodeFormSchema>;
