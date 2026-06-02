import type { Locale } from "@prisma/client";

import {
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TYPES,
  photoUploadMetaSchema,
  updateInstructorProfileSchema,
  type PhotoUploadMeta,
  type UpdateInstructorProfileInput,
} from "@/lib/schemas/instructor-profile";

/** Dep-injected surface mirroring `@vercel/blob`'s `put` + `del` signatures
 * (only the bits we use). `null` means "Blob is not configured for this
 * environment" — the action layer sets it to null when
 * `BLOB_READ_WRITE_TOKEN` is missing, letting the pure helper return a clean
 * `BLOB_NOT_CONFIGURED` error without throwing. */
export type BlobClient = {
  put(
    pathname: string,
    body: Blob | File | ArrayBuffer | string,
    options: { access: "public"; addRandomSuffix?: boolean },
  ): Promise<{ url: string }>;
  del(url: string): Promise<void>;
};

type ProfileRow = {
  id: string;
  photo: string | null;
  bio: string | null;
  specialties: string[];
  languages: Locale[];
  active: boolean;
  acceptsSameDayIfBooked: boolean;
};

export type UpdateProfileDeps = {
  prisma: UpdatePrismaSurface;
  instructorId: string;
};

export type UploadPhotoDeps = {
  prisma: PhotoPrismaSurface;
  /** `null` ⇒ Blob env var missing in this runtime. */
  blob: BlobClient | null;
  instructorId: string;
  now?: Date;
  /** Optional sink for swallowed best-effort errors (old-blob delete failure,
   * etc). Production passes `Sentry.captureException`; tests pass `vi.fn()`. */
  onWarning?: (err: unknown, ctx: Record<string, unknown>) => void;
};

export type UpdateProfileResult =
  | { ok: true; profile: ProfileRow }
  | { ok: false; error: "INVALID_INPUT" | "NOT_FOUND" };

export type UploadPhotoResult =
  | { ok: true; photoUrl: string }
  | {
      ok: false;
      error:
        | "INVALID_INPUT"
        | "INVALID_MIME"
        | "TOO_LARGE"
        | "BLOB_NOT_CONFIGURED"
        | "NOT_FOUND"
        | "UPLOAD_FAILED";
    };

export type RemovePhotoResult =
  | { ok: true }
  | { ok: false; error: "BLOB_NOT_CONFIGURED" | "NOT_FOUND" };

type UpdatePrismaSurface = {
  instructor: {
    update(args: {
      where: { id: string };
      data: {
        bio: string | null;
        specialties: string[];
        languages: Locale[];
        active: boolean;
        acceptsSameDayIfBooked: boolean;
      };
      select: ProfileSelect;
    }): Promise<ProfileRow>;
  };
};

type PhotoPrismaSurface = {
  instructor: {
    findUnique(args: {
      where: { id: string };
      select: { photo: true };
    }): Promise<{ photo: string | null } | null>;
    update(args: {
      where: { id: string };
      data: { photo: string | null };
      select: ProfileSelect;
    }): Promise<ProfileRow>;
  };
};

type ProfileSelect = {
  id: true;
  photo: true;
  bio: true;
  specialties: true;
  languages: true;
  active: true;
  acceptsSameDayIfBooked: true;
};

const PROFILE_SELECT: ProfileSelect = {
  id: true,
  photo: true,
  bio: true,
  specialties: true,
  languages: true,
  active: true,
  acceptsSameDayIfBooked: true,
};

/** Re-export so callers can size their `<input type="file">` accept attribute
 * + show the limit in the UI without re-defining it. */
export { PHOTO_MAX_BYTES, PHOTO_MIME_TYPES };

/**
 * F-073: persist a profile edit. Pure server logic; the action layer adds
 * `requireInstructor()` and cache invalidation.
 *
 * Empty bio is stored as `null` (the DB column is nullable, and empty-string
 * vs null on a Text column tends to cause "bio: ''" vs "bio: null" drift in
 * downstream consumers). Duplicated specialties are de-duplicated in the
 * schema's `transform`.
 */
export async function updateInstructorProfile(
  deps: UpdateProfileDeps,
  input: UpdateInstructorProfileInput,
): Promise<UpdateProfileResult> {
  const parsed = updateInstructorProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  const data = parsed.data;
  try {
    const profile = await deps.prisma.instructor.update({
      where: { id: deps.instructorId },
      data: {
        bio: data.bio.length === 0 ? null : data.bio,
        specialties: data.specialties,
        languages: data.languages,
        active: data.active,
        acceptsSameDayIfBooked: data.acceptsSameDayIfBooked,
      },
      select: PROFILE_SELECT,
    });
    return { ok: true, profile };
  } catch (err) {
    if (isPrismaNotFoundError(err)) {
      return { ok: false, error: "NOT_FOUND" };
    }
    throw err;
  }
}

/**
 * F-073: upload a new photo to Vercel Blob and point the instructor row at it.
 * The old blob (if any) is deleted on a best-effort basis — its failure must
 * not undo the successful upload, just emit a warning. Returns the public URL
 * the booker side will render via `next/image`.
 */
export async function uploadInstructorPhoto(
  deps: UploadPhotoDeps,
  file: Blob | File,
  meta: PhotoUploadMeta,
): Promise<UploadPhotoResult> {
  if (!deps.blob) {
    return { ok: false, error: "BLOB_NOT_CONFIGURED" };
  }
  const parsed = photoUploadMetaSchema.safeParse(meta);
  if (!parsed.success) {
    // The two failure modes the UI cares about (mime / size) each get their
    // own code so we can give a precise inline message.
    const flat = parsed.error.flatten().fieldErrors;
    if (flat.mime?.length) return { ok: false, error: "INVALID_MIME" };
    if (flat.sizeBytes?.length) return { ok: false, error: "TOO_LARGE" };
    return { ok: false, error: "INVALID_INPUT" };
  }
  const { mime } = parsed.data;

  const existing = await deps.prisma.instructor.findUnique({
    where: { id: deps.instructorId },
    select: { photo: true },
  });
  if (!existing) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const pathname = `instructors/${deps.instructorId}/photo.${ext}`;

  let uploaded: { url: string };
  try {
    uploaded = await deps.blob.put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
    });
  } catch (err) {
    deps.onWarning?.(err, { stage: "blob_put", instructorId: deps.instructorId });
    return { ok: false, error: "UPLOAD_FAILED" };
  }

  let profile: ProfileRow;
  try {
    profile = await deps.prisma.instructor.update({
      where: { id: deps.instructorId },
      data: { photo: uploaded.url },
      select: PROFILE_SELECT,
    });
  } catch (err) {
    // The instructor was deleted between the lookup and the update. Try to
    // clean up the just-uploaded blob so it doesn't linger.
    if (deps.blob) {
      try {
        await deps.blob.del(uploaded.url);
      } catch (delErr) {
        deps.onWarning?.(delErr, {
          stage: "blob_del_orphan",
          url: uploaded.url,
        });
      }
    }
    if (isPrismaNotFoundError(err)) {
      return { ok: false, error: "NOT_FOUND" };
    }
    throw err;
  }

  if (existing.photo) {
    try {
      await deps.blob.del(existing.photo);
    } catch (err) {
      // Best-effort: a stale blob is cheaper than a failed upload.
      deps.onWarning?.(err, { stage: "blob_del_previous", url: existing.photo });
    }
  }

  return { ok: true, photoUrl: profile.photo! };
}

/** Clear the instructor's photo. Best-effort blob delete; the DB clear is the
 * source of truth. */
export async function removeInstructorPhoto(
  deps: UploadPhotoDeps,
): Promise<RemovePhotoResult> {
  if (!deps.blob) {
    return { ok: false, error: "BLOB_NOT_CONFIGURED" };
  }
  const existing = await deps.prisma.instructor.findUnique({
    where: { id: deps.instructorId },
    select: { photo: true },
  });
  if (!existing) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (!existing.photo) {
    // Already cleared. Idempotent.
    return { ok: true };
  }
  try {
    await deps.prisma.instructor.update({
      where: { id: deps.instructorId },
      data: { photo: null },
      select: PROFILE_SELECT,
    });
  } catch (err) {
    if (isPrismaNotFoundError(err)) {
      return { ok: false, error: "NOT_FOUND" };
    }
    throw err;
  }
  try {
    await deps.blob.del(existing.photo);
  } catch (err) {
    deps.onWarning?.(err, { stage: "blob_del_previous", url: existing.photo });
  }
  return { ok: true };
}

function isPrismaNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2025"
  );
}
