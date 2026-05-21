import { Duration, Level, Locale } from "@prisma/client";
import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const E164 = /^\+?[1-9]\d{7,14}$/;

export const draftAttendeeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  age: z.coerce.number().int().min(4).max(99),
  level: z.nativeEnum(Level),
});

export const createBookingDraftSchema = z.object({
  date: z.string().regex(ISO_DATE, { message: "INVALID_DATE" }),
  time: z.string().regex(HHMM, { message: "INVALID_TIME" }),
  duration: z.nativeEnum(Duration),
  instructorId: z
    .string()
    .min(1)
    .refine((v) => v !== "ANYONE", { message: "INSTRUCTOR_NOT_RESOLVED" }),
  language: z.nativeEnum(Locale),
  bookerName: z.string().trim().min(1).max(80),
  bookerPhone: z
    .string()
    .trim()
    .transform((raw) => raw.replace(/\s+/g, ""))
    .pipe(z.string().regex(E164, { message: "INVALID_PHONE" })),
  attendees: z.array(draftAttendeeSchema).min(1).max(4),
  notes: z.string().trim().max(500).optional().default(""),
  acceptedTerms: z.literal(true),
});

export type CreateBookingDraftInput = z.infer<typeof createBookingDraftSchema>;
export type DraftAttendeeInput = z.infer<typeof draftAttendeeSchema>;

export type CreateBookingDraftError =
  | "UNAUTHORIZED"
  | "INVALID_INPUT"
  | "NO_ACTIVE_SEASON"
  | "PRICING_MISSING"
  | "SLOT_TAKEN";

export type CreateBookingDraftResult =
  | {
      ok: true;
      bookingId: string;
      clientSecret: string;
      totalPriceCents: number;
      reused: boolean;
    }
  | {
      ok: false;
      error: CreateBookingDraftError;
      issues?: z.ZodIssue[];
    };
