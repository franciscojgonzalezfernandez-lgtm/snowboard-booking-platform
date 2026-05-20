import { Level } from "@prisma/client";
import { z } from "zod";

// E.164: optional leading +, 8-15 digits, no spaces. Browser-level validation is
// loose to keep paste-friendly UX; the strict version runs on the server (F-042).
const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

export const attendeeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  age: z.coerce.number().int().min(4).max(99),
  level: z.nativeEnum(Level),
});

export const step4FormSchema = z.object({
  bookerName: z.string().trim().min(1).max(80),
  bookerPhone: z
    .string()
    .trim()
    .refine((raw) => PHONE_REGEX.test(raw.replace(/\s+/g, "")), {
      message: "PHONE_INVALID",
    }),
  attendees: z.array(attendeeSchema).min(1).max(4),
  notes: z.string().trim().max(500).optional().default(""),
  acceptedTerms: z.literal(true),
});

export type Step4FormValues = z.infer<typeof step4FormSchema>;
export type AttendeeInput = z.infer<typeof attendeeSchema>;

/** Encode the attendees array for forwarding to step-5 via the URL. */
export function encodeAttendees(attendees: AttendeeInput[]): string {
  const json = JSON.stringify(attendees);
  if (typeof window === "undefined") {
    return Buffer.from(json, "utf8").toString("base64");
  }
  return window.btoa(unescape(encodeURIComponent(json)));
}

/** Inverse of `encodeAttendees`, used by step-5 / F-042 server action. */
export function decodeAttendees(encoded: string): AttendeeInput[] {
  const json =
    typeof window === "undefined"
      ? Buffer.from(encoded, "base64").toString("utf8")
      : decodeURIComponent(escape(window.atob(encoded)));
  const parsed: unknown = JSON.parse(json);
  return z.array(attendeeSchema).parse(parsed);
}
