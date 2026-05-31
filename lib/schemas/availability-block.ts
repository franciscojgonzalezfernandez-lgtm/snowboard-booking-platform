import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * F-072: input the instructor submits to create one AVAILABLE block.
 * `date` is wall-clock UTC (matches the existing booking-engine convention,
 * see `lib/booking-engine/time.ts:setUtcTime`); start/end are HH:MM strings
 * on that same date. A block always lives within a single calendar day —
 * multi-day spans are intentionally out of scope (F-072 spec).
 */
export const createAvailabilityBlockSchema = z
  .object({
    date: z.string().regex(ISO_DATE, { message: "INVALID_DATE" }),
    startTime: z.string().regex(HHMM, { message: "INVALID_START_TIME" }),
    endTime: z.string().regex(HHMM, { message: "INVALID_END_TIME" }),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "END_BEFORE_OR_EQUAL_START",
    path: ["endTime"],
  });

export type CreateAvailabilityBlockInput = z.infer<
  typeof createAvailabilityBlockSchema
>;
