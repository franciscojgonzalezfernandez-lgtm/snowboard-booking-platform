import { z } from "zod";

import { E164 } from "./phone";

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
