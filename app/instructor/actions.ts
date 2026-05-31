"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath, revalidateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { requireInstructor } from "@/lib/auth/require-instructor";
import { AVAILABILITY_TAGS } from "@/lib/booking-engine/cache";
import { prisma } from "@/lib/db";
import {
  createInstructorAvailabilityBlock,
  deleteInstructorAvailabilityBlock,
  type CreateBlockResult,
  type DeleteBlockResult,
} from "@/lib/instructor/availability-block";
import {
  removeInstructorPhoto,
  updateInstructorProfile as updateInstructorProfileImpl,
  uploadInstructorPhoto,
  type BlobClient,
  type RemovePhotoResult,
  type UpdateProfileResult,
  type UploadPhotoResult,
} from "@/lib/instructor/profile";
import type { CreateAvailabilityBlockInput } from "@/lib/schemas/availability-block";
import type { UpdateInstructorProfileInput } from "@/lib/schemas/instructor-profile";

/**
 * Instructor Server Actions. Thin session + cache-invalidation wrappers; the
 * policy / DB writes live in `lib/instructor/*`.
 *
 * Booker-side availability is cached (`lib/booking-engine/cache.ts`), so a
 * successful mutation must bust `AVAILABILITY_TAGS.root` — otherwise a freshly
 * created block (or edited profile field) doesn't show up on `/reservar` until
 * the 30-min revalidate.
 */

function blobClient(): BlobClient | null {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  return {
    async put(pathname, body, options) {
      const result = await put(pathname, body, options);
      return { url: result.url };
    },
    async del(url) {
      await del(url);
    },
  };
}

function bustInstructorCaches(paths: string[]) {
  for (const path of paths) revalidatePath(path);
  revalidateTag(AVAILABILITY_TAGS.root);
}

// ──────────────────────────────────────────────────────────────────────────
// F-072: availability block CRUD

export async function createAvailabilityBlock(
  input: CreateAvailabilityBlockInput,
): Promise<CreateBlockResult> {
  const { instructorId } = await requireInstructor();
  const result = await createInstructorAvailabilityBlock(
    { prisma, instructorId, now: new Date() },
    input,
  );
  if (result.ok) {
    bustInstructorCaches(["/instructor/availability", "/instructor"]);
  } else if (result.error === "NO_ACTIVE_SEASON") {
    // Misconfiguration, not a user error — surface to Sentry too.
    Sentry.captureMessage("availability_create_no_active_season", "warning");
  }
  return result;
}

export async function deleteAvailabilityBlock(
  id: string,
): Promise<DeleteBlockResult> {
  const { instructorId } = await requireInstructor();
  const result = await deleteInstructorAvailabilityBlock(
    { prisma, instructorId },
    id,
  );
  if (result.ok) {
    bustInstructorCaches(["/instructor/availability", "/instructor"]);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────
// F-073: profile edit + photo upload

export async function updateInstructorProfile(
  input: UpdateInstructorProfileInput,
): Promise<UpdateProfileResult> {
  const { instructorId } = await requireInstructor();
  const result = await updateInstructorProfileImpl(
    { prisma, instructorId },
    input,
  );
  if (result.ok) bustInstructorCaches(["/instructor/profile", "/instructor"]);
  return result;
}

export async function uploadInstructorPhotoAction(
  formData: FormData,
): Promise<UploadPhotoResult> {
  const { instructorId } = await requireInstructor();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  const blob = blobClient();
  const result = await uploadInstructorPhoto(
    {
      prisma,
      blob,
      instructorId,
      onWarning: (err, ctx) => Sentry.captureException(err, { extra: ctx }),
    },
    file,
    { mime: file.type as never, sizeBytes: file.size },
  );
  if (result.ok) bustInstructorCaches(["/instructor/profile", "/instructor"]);
  return result;
}

export async function removeInstructorPhotoAction(): Promise<RemovePhotoResult> {
  const { instructorId } = await requireInstructor();
  const blob = blobClient();
  const result = await removeInstructorPhoto({
    prisma,
    blob,
    instructorId,
    onWarning: (err, ctx) => Sentry.captureException(err, { extra: ctx }),
  });
  if (result.ok) bustInstructorCaches(["/instructor/profile", "/instructor"]);
  return result;
}
