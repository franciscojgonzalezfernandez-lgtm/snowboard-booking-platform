import { z } from "zod";

/**
 * F-065: per-booking instructor note. Plain text only (no rich text — see the
 * ticket notes). `note` is nullable so the action can clear it; an empty /
 * whitespace-only string is normalised to `null` by the server logic.
 */
export const INSTRUCTOR_NOTE_MAX = 5000;

export const instructorNoteSchema = z.object({
  bookingId: z.string().min(1),
  note: z.string().max(INSTRUCTOR_NOTE_MAX).nullable(),
});

export type InstructorNoteInput = z.infer<typeof instructorNoteSchema>;
