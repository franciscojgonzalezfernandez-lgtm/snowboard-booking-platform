import { z } from "zod";

import { attendeeSchema, type AttendeeInput } from "./attendee";
import { E164 } from "./phone";

export const step4FormSchema = z.object({
  bookerName: z.string().trim().min(1).max(80),
  bookerPhone: z
    .string()
    .trim()
    // Browser-level validation strips spaces to keep paste-friendly UX; the
    // strict version runs on the server (F-042).
    .refine((raw) => E164.test(raw.replace(/\s+/g, "")), {
      message: "PHONE_INVALID",
    }),
  attendees: z.array(attendeeSchema).min(1).max(4),
  notes: z.string().trim().max(500).optional().default(""),
  acceptedTerms: z.literal(true),
});

export type Step4FormValues = z.infer<typeof step4FormSchema>;

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
