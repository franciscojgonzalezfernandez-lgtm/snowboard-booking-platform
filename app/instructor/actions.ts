"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath, revalidateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { requireInstructor } from "@/lib/auth/require-instructor";
import { AVAILABILITY_TAGS } from "@/lib/booking-engine/cache";
import { prisma } from "@/lib/db";
import {
  blockAvailabilityWindowWith,
  clearAvailabilityWith,
  openAvailabilityRangeWith,
  type AvailabilityDeps,
  type BlockWindowResult,
  type ClearResult,
  type OpenRangeResult,
} from "@/lib/instructor/availability-actions";
import {
  createInstructorAvailabilityBlock,
  deleteInstructorAvailabilityBlock,
  type CreateBlockResult,
  type DeleteBlockResult,
} from "@/lib/instructor/availability-block";
import {
  markNoShowWith,
  type MarkNoShowResult,
} from "@/lib/booking/mark-no-show";
import {
  setInstructorNoteWith,
  type SetInstructorNoteResult,
} from "@/lib/instructor/instructor-note";
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
 * Surfaces sharing this file:
 *   - F-072 availability page  → availability-block.ts (create/delete block)
 *   - F-073 profile page       → profile.ts            (update + photo)
 *   - F-083 calendar           → availability-actions.ts (open/block/clear)
 *
 * Booker-side availability is cached (`lib/booking-engine/cache.ts`), so any
 * successful mutation must bust `AVAILABILITY_TAGS.root` — otherwise a fresh
 * block / edited field doesn't show on `/reservar` until the 30-min revalidate.
 */

function instructorDeps(instructorId: string): AvailabilityDeps {
  return {
    prisma,
    instructorId,
  };
}

// F-083 calendar bust set (includes /instructor/calendar). F-072/F-073 use
// `bustInstructorCaches(paths)` below to pick the exact surfaces they touch.
function revalidateInstructor() {
  revalidatePath("/instructor");
  revalidatePath("/instructor/calendar");
  revalidatePath("/instructor/availability");
  revalidateTag(AVAILABILITY_TAGS.root);
}

// ──────────────────────────────────────────────────────────────────────────
// F-083: calendar range mutations

export async function openAvailabilityRange(input: {
  fromDate: string;
  toDate: string;
}): Promise<OpenRangeResult> {
  const { instructorId } = await requireInstructor();
  let result: OpenRangeResult;
  try {
    result = await openAvailabilityRangeWith(instructorDeps(instructorId), input);
  } catch (err) {
    // Tagged capture + rethrow, mirroring app/admin/actions.ts: expected
    // failures come back as { ok: false }; a throw here is an infra error.
    Sentry.captureException(err, {
      tags: { source: "open-availability-range" },
    });
    throw err;
  }
  if (result.ok) revalidateInstructor();
  return result;
}

export async function blockAvailabilityWindow(input: {
  date: string;
  startTime: string;
  endTime: string;
}): Promise<BlockWindowResult> {
  const { instructorId } = await requireInstructor();
  let result: BlockWindowResult;
  try {
    result = await blockAvailabilityWindowWith(instructorDeps(instructorId), input);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { source: "block-availability-window" },
    });
    throw err;
  }
  if (result.ok) revalidateInstructor();
  return result;
}

export async function clearAvailability(input: {
  blockId: string;
}): Promise<ClearResult> {
  const { instructorId } = await requireInstructor();
  let result: ClearResult;
  try {
    result = await clearAvailabilityWith(instructorDeps(instructorId), input);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { source: "clear-availability" },
      extra: { blockId: input.blockId },
    });
    throw err;
  }
  if (result.ok) revalidateInstructor();
  return result;
}

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
      onWarning: (err, ctx) => {
        Sentry.captureException(err, { extra: ctx });
        // In production Sentry collects the cause; in dev (no DSN) it would
        // be swallowed, so always echo to the server console too. Cheap and
        // makes blob-token / blob-config issues visible immediately.
        console.error("[F-073] blob warning", ctx, err);
      },
    },
    file,
    { mime: file.type as never, sizeBytes: file.size },
  );
  if (result.ok) bustInstructorCaches(["/instructor/profile", "/instructor"]);
  return result;
}

export type DisconnectCalendarResult = { ok: true };

/**
 * Drop the stored Google refresh token + flip `calendarConnected` off. The
 * encrypted token is simply discarded; revoking access on Google's side is the
 * instructor's choice (a cleared token is inert regardless).
 */
export async function disconnectCalendar(): Promise<DisconnectCalendarResult> {
  const { instructorId } = await requireInstructor();
  try {
    await prisma.instructor.update({
      where: { id: instructorId },
      data: { googleRefreshToken: null, calendarConnected: false },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { source: "disconnect-calendar" },
      extra: { instructorId },
    });
    throw err;
  }
  revalidatePath("/instructor/calendar");
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// F-065: instructor feedback per booking

/**
 * Set or clear the instructor's private note on a COMPLETED booking. The pure
 * helper re-checks ownership + status; this wrapper only adds the session guard
 * and revalidates the agenda so the persisted value (and booker history) is
 * fresh on next render. Internal-only — never surfaced to the booker.
 */
export async function setInstructorNote(
  bookingId: string,
  note: string | null,
): Promise<SetInstructorNoteResult> {
  const { instructorId } = await requireInstructor();
  const result = await setInstructorNoteWith(
    { prisma, instructorId, now: new Date() },
    { bookingId, note },
  );
  if (result.ok) revalidatePath("/instructor");
  return result;
}

/**
 * F-081: re-flip one of *this instructor's* auto-completed bookings to a
 * no-show (CANCELLED_BY_USER, no credit). Ownership-scoped — the core rejects
 * (FORBIDDEN) any booking not owned by the session instructor. The admin
 * surface (F-077) has its own unscoped wrapper in `app/admin/actions.ts`.
 */
export async function markNoShow(input: {
  bookingId: string;
}): Promise<MarkNoShowResult> {
  const { instructorId } = await requireInstructor();
  const result = await markNoShowWith({ prisma, instructorId }, input);
  if (result.ok) {
    revalidatePath("/instructor");
    revalidatePath("/admin");
  }
  return result;
}

export async function removeInstructorPhotoAction(): Promise<RemovePhotoResult> {
  const { instructorId } = await requireInstructor();
  const blob = blobClient();
  const result = await removeInstructorPhoto({
    prisma,
    blob,
    instructorId,
    onWarning: (err, ctx) => {
      Sentry.captureException(err, { extra: ctx });
      console.error("[F-073] blob warning", ctx, err);
    },
  });
  if (result.ok) bustInstructorCaches(["/instructor/profile", "/instructor"]);
  return result;
}
