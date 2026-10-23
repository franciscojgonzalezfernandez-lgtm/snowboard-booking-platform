import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * F-157: input for moving a CONFIRMED booking to a new slot. The duration is
 * NOT part of the input — a move keeps the original lesson's duration (and its
 * price), so the server reads it from the booking row. The new slot must still
 * clear the live availability engine, exactly like a fresh booking.
 */
export const rescheduleBookingSchema = z.object({
  bookingId: z.string().min(1),
  newDate: z.string().regex(ISO_DATE, { message: "INVALID_DATE" }),
  newAnchorTime: z.string().regex(HHMM, { message: "INVALID_TIME" }),
  // Mirrors createBookingDraftSchema: "ANYONE" must be resolved to a concrete
  // instructor client-side before the call reaches the server.
  newInstructorId: z
    .string()
    .min(1)
    .refine((v) => v !== "ANYONE", { message: "INSTRUCTOR_NOT_RESOLVED" }),
});

export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
