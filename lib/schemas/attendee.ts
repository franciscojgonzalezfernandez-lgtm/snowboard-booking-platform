import { Level } from "@prisma/client";
import { z } from "zod";

/**
 * Attendee contract shared by the step-4 form (client validation) and the
 * step-5 `createBookingDraft` server action — one source so the form and the
 * server can't silently drift apart.
 */
export const attendeeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  age: z.coerce.number().int().min(4).max(99),
  level: z.nativeEnum(Level),
});

export type AttendeeInput = z.infer<typeof attendeeSchema>;
