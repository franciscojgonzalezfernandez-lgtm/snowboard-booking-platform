import { Locale } from "@prisma/client";
import { z } from "zod";

/** F-073 update form. `languages` requires at least one locale — saving with
 * none would hide the instructor from Step 3 entirely (booker can't pick a
 * language match), which is almost certainly a mistake. */
export const updateInstructorProfileSchema = z.object({
  bio: z.string().trim().max(2000),
  specialties: z
    .array(z.string().trim().min(1).max(40))
    .max(12)
    .transform((arr) => Array.from(new Set(arr))),
  languages: z.array(z.nativeEnum(Locale)).min(1),
  active: z.boolean(),
  acceptsSameDayIfBooked: z.boolean(),
});

export type UpdateInstructorProfileInput = z.infer<
  typeof updateInstructorProfileSchema
>;

/** Validates File metadata for the photo upload independently of FormData
 * parsing. The pure helper compares against this so unit tests don't need a
 * real Blob/File runtime. */
export const PHOTO_MAX_BYTES = 5_000_000;
export const PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const photoUploadMetaSchema = z.object({
  mime: z.enum(PHOTO_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(PHOTO_MAX_BYTES),
});

export type PhotoUploadMeta = z.infer<typeof photoUploadMetaSchema>;
