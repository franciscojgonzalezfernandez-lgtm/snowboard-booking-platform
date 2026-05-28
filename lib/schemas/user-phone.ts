import { z } from "zod";

/**
 * E.164-ish phone rule: optional leading `+`, a non-zero first digit, and 8–15
 * digits in total. Mirrors the booker-phone rule in `booking-draft.ts` so the
 * dashboard edit (F-064b) and the booking form (F-041) accept the same shape.
 */
export const E164 = /^\+?[1-9]\d{7,14}$/;

/**
 * Dashboard phone edit (F-064b). Accepts a raw form string, strips all
 * whitespace, and maps the empty string to `null` (phone removed). A non-empty
 * value must match {@link E164}, otherwise the schema fails with INVALID_PHONE.
 * Output is `string | null`; input is the raw form `string`.
 */
export const userPhoneSchema = z
  .string()
  .transform((raw) => raw.replace(/\s+/g, ""))
  .refine((v) => v === "" || E164.test(v), { message: "INVALID_PHONE" })
  .transform((v) => (v === "" ? null : v));

/** Object wrapper consumed by React Hook Form's `zodResolver` in the edit card. */
export const phoneFormSchema = z.object({ phone: userPhoneSchema });

export type PhoneFormInput = z.input<typeof phoneFormSchema>; // { phone: string }
export type PhoneFormOutput = z.output<typeof phoneFormSchema>; // { phone: string | null }
