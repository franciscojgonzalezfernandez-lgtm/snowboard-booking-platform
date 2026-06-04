import { Locale } from "@prisma/client";
import { z } from "zod";

// Shared Zod schemas for admin instructor CRUD (F-076). Consumed by the
// dependency-injected cores in `lib/admin/instructors.ts` and re-validated in
// the `"use server"` wrappers in `app/admin/actions.ts`.

const LOCALE = z.nativeEnum(Locale);

export const createInstructorSchema = z.object({
  name: z.string().trim().min(1, "NAME_REQUIRED").max(80, "NAME_TOO_LONG"),
  email: z.string().trim().toLowerCase().email("INVALID_EMAIL"),
  bio: z.string().trim().max(2000, "BIO_TOO_LONG").optional(),
  languages: z.array(LOCALE).min(1, "LANGUAGE_REQUIRED"),
  specialties: z.array(z.string().trim().min(1)).default([]),
});

export const updateInstructorSchema = z.object({
  instructorId: z.string().min(1),
  bio: z.string().trim().max(2000, "BIO_TOO_LONG").optional(),
  languages: z.array(LOCALE).min(1, "LANGUAGE_REQUIRED").optional(),
  active: z.boolean().optional(),
});

export const deactivateInstructorSchema = z.object({
  instructorId: z.string().min(1),
});

export type CreateInstructorInput = z.input<typeof createInstructorSchema>;
export type UpdateInstructorInput = z.infer<typeof updateInstructorSchema>;
export type DeactivateInstructorInput = z.infer<typeof deactivateInstructorSchema>;
