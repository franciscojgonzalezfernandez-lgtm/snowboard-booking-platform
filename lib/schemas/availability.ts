import { Duration } from "@prisma/client";
import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Expected YYYY-MM-DD")
  .transform((value, ctx) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid calendar date" });
      return z.NEVER;
    }
    return parsed;
  });

const duration = z.enum(Duration);

export const MAX_CALENDAR_RANGE_DAYS = 92;
const dayMs = 24 * 60 * 60 * 1000;

export const calendarQuerySchema = z
  .object({
    duration,
    monthFrom: isoDate,
    monthTo: isoDate,
  })
  .refine(
    (v) =>
      !(v.monthFrom instanceof Date && v.monthTo instanceof Date) ||
      v.monthTo >= v.monthFrom,
    {
      message: "monthTo must be on or after monthFrom",
      path: ["monthTo"],
    },
  )
  .refine(
    (v) =>
      !(v.monthFrom instanceof Date && v.monthTo instanceof Date) ||
      (v.monthTo.getTime() - v.monthFrom.getTime()) / dayMs <=
        MAX_CALENDAR_RANGE_DAYS,
    {
      message: `Range exceeds ${MAX_CALENDAR_RANGE_DAYS} days`,
      path: ["monthTo"],
    },
  );

export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

export const nearbyQuerySchema = z.object({
  duration,
  date: isoDate,
});

export type NearbyQuery = z.infer<typeof nearbyQuerySchema>;

export const slotsQuerySchema = z.object({
  duration,
  date: isoDate,
});

export type SlotsQuery = z.infer<typeof slotsQuerySchema>;

/**
 * Parses a `URLSearchParams`-like object and returns a Zod `safeParse` result.
 * Centralized so every availability route stringifies errors the same way.
 */
export function parseSearchParams<T extends z.ZodType>(
  schema: T,
  params: URLSearchParams,
) {
  const obj: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    obj[key] = value;
  }
  return schema.safeParse(obj);
}

export function zodErrorToResponse(error: z.ZodError): {
  error: string;
  issues: Array<{ path: string; message: string }>;
} {
  return {
    error: "Invalid query parameters",
    issues: error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
}
