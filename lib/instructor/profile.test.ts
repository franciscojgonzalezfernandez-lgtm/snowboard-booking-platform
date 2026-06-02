import { describe, expect, test, vi } from "vitest";
import { Locale } from "@prisma/client";

import {
  removeInstructorPhoto,
  updateInstructorProfile,
  uploadInstructorPhoto,
  type BlobClient,
} from "./profile";

const INSTRUCTOR_ID = "instr_javi";

function makeProfile(overrides: Partial<{
  photo: string | null;
  bio: string | null;
  specialties: string[];
  languages: Locale[];
  active: boolean;
  acceptsSameDayIfBooked: boolean;
}> = {}) {
  return {
    id: INSTRUCTOR_ID,
    photo: null,
    bio: null,
    specialties: [],
    languages: [Locale.en],
    active: true,
    acceptsSameDayIfBooked: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// updateInstructorProfile

function makeUpdateDeps(initial = makeProfile()) {
  const update = vi.fn(
    async (args: {
      where: { id: string };
      data: {
        bio: string | null;
        specialties: string[];
        languages: Locale[];
        active: boolean;
        acceptsSameDayIfBooked: boolean;
      };
    }) => ({ ...initial, ...args.data }),
  );
  const prisma = { instructor: { update } };
  return {
    deps: {
      prisma: prisma as unknown as Parameters<typeof updateInstructorProfile>[0]["prisma"],
      instructorId: INSTRUCTOR_ID,
    },
    spies: { update },
  };
}

describe("updateInstructorProfile", () => {
  test("happy path persists every field + empty bio becomes null", async () => {
    const { deps, spies } = makeUpdateDeps();
    const res = await updateInstructorProfile(deps, {
      bio: "",
      specialties: ["freestyle", "kids"],
      languages: [Locale.en, Locale.de],
      active: true,
      acceptsSameDayIfBooked: false,
    });
    expect(res.ok).toBe(true);
    expect(spies.update).toHaveBeenCalledWith({
      where: { id: INSTRUCTOR_ID },
      data: {
        bio: null,
        specialties: ["freestyle", "kids"],
        languages: [Locale.en, Locale.de],
        active: true,
        acceptsSameDayIfBooked: false,
      },
      select: expect.any(Object),
    });
  });

  test("duplicate specialties are de-duplicated by the schema transform", async () => {
    const { deps, spies } = makeUpdateDeps();
    await updateInstructorProfile(deps, {
      bio: "x",
      specialties: ["freestyle", "freestyle", "kids"],
      languages: [Locale.en],
      active: true,
      acceptsSameDayIfBooked: false,
    });
    const call = spies.update.mock.calls[0]![0] as {
      data: { specialties: string[] };
    };
    expect(call.data.specialties).toEqual(["freestyle", "kids"]);
  });

  test("bio > 2000 chars → INVALID_INPUT, no DB write", async () => {
    const { deps, spies } = makeUpdateDeps();
    const res = await updateInstructorProfile(deps, {
      bio: "a".repeat(2001),
      specialties: [],
      languages: [Locale.en],
      active: true,
      acceptsSameDayIfBooked: false,
    });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(spies.update).not.toHaveBeenCalled();
  });

  test("specialties > 12 → INVALID_INPUT", async () => {
    const { deps } = makeUpdateDeps();
    const res = await updateInstructorProfile(deps, {
      bio: "",
      specialties: Array.from({ length: 13 }, (_, i) => `s${i}`),
      languages: [Locale.en],
      active: true,
      acceptsSameDayIfBooked: false,
    });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("empty languages array → INVALID_INPUT (instructor can't teach with no languages)", async () => {
    const { deps } = makeUpdateDeps();
    const res = await updateInstructorProfile(deps, {
      bio: "",
      specialties: [],
      languages: [],
      active: true,
      acceptsSameDayIfBooked: false,
    });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("Prisma P2025 → NOT_FOUND", async () => {
    const { deps } = makeUpdateDeps();
    (deps.prisma.instructor.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("not found"), { code: "P2025" }),
    );
    const res = await updateInstructorProfile(deps, {
      bio: "x",
      specialties: [],
      languages: [Locale.en],
      active: true,
      acceptsSameDayIfBooked: false,
    });
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// uploadInstructorPhoto

function makePhotoDeps(opts?: {
  existingPhoto?: string | null;
  blob?: BlobClient | null;
  uploadUrl?: string;
  uploadError?: Error;
  delError?: Error;
}) {
  const blob: BlobClient =
    opts?.blob === undefined
      ? {
          put: vi.fn(async () => {
            if (opts?.uploadError) throw opts.uploadError;
            return { url: opts?.uploadUrl ?? "https://blob.example/new.jpg" };
          }),
          del: vi.fn(async () => {
            if (opts?.delError) throw opts.delError;
          }),
        }
      : (opts.blob as BlobClient);

  const findUnique = vi.fn(async () => ({
    photo: opts?.existingPhoto === undefined ? null : opts.existingPhoto,
  }));
  const update = vi.fn(
    async (args: { data: { photo: string | null } }) => makeProfile({ photo: args.data.photo }),
  );
  const prisma = { instructor: { findUnique, update } };
  const onWarning = vi.fn();
  return {
    deps: {
      prisma: prisma as unknown as Parameters<typeof uploadInstructorPhoto>[0]["prisma"],
      blob: opts?.blob === null ? null : blob,
      instructorId: INSTRUCTOR_ID,
      onWarning,
    },
    spies: { findUnique, update, onWarning, blob },
  };
}

const VALID_JPEG_META = { mime: "image/jpeg" as const, sizeBytes: 100_000 };

describe("uploadInstructorPhoto", () => {
  test("happy path: blob.put called, DB updated, returns public URL", async () => {
    const file = new Blob(["payload"]);
    const { deps, spies } = makePhotoDeps();
    const res = await uploadInstructorPhoto(deps, file, VALID_JPEG_META);
    expect(res).toEqual({ ok: true, photoUrl: "https://blob.example/new.jpg" });
    expect(spies.blob.put).toHaveBeenCalledWith(
      `instructors/${INSTRUCTOR_ID}/photo.jpg`,
      file,
      { access: "public", addRandomSuffix: true },
    );
    expect(spies.update).toHaveBeenCalledWith({
      where: { id: INSTRUCTOR_ID },
      data: { photo: "https://blob.example/new.jpg" },
      select: expect.any(Object),
    });
    expect(spies.blob.del).not.toHaveBeenCalled(); // no previous photo
  });

  test("replaces existing photo: old blob is del()'d after successful update", async () => {
    const { deps, spies } = makePhotoDeps({ existingPhoto: "https://blob.example/old.jpg" });
    await uploadInstructorPhoto(deps, new Blob(["x"]), VALID_JPEG_META);
    expect(spies.blob.del).toHaveBeenCalledWith("https://blob.example/old.jpg");
  });

  test("BLOB_NOT_CONFIGURED when blob client is null (env var missing)", async () => {
    const { deps } = makePhotoDeps({ blob: null });
    const res = await uploadInstructorPhoto(deps, new Blob(["x"]), VALID_JPEG_META);
    expect(res).toEqual({ ok: false, error: "BLOB_NOT_CONFIGURED" });
  });

  test("INVALID_MIME for an unsupported image type", async () => {
    const { deps, spies } = makePhotoDeps();
    const res = await uploadInstructorPhoto(deps, new Blob(["x"]), {
      mime: "image/gif" as unknown as "image/png",
      sizeBytes: 1000,
    });
    expect(res).toEqual({ ok: false, error: "INVALID_MIME" });
    expect(spies.blob.put).not.toHaveBeenCalled();
  });

  test("TOO_LARGE when sizeBytes > 5MB", async () => {
    const { deps, spies } = makePhotoDeps();
    const res = await uploadInstructorPhoto(deps, new Blob(["x"]), {
      mime: "image/jpeg",
      sizeBytes: 5_000_001,
    });
    expect(res).toEqual({ ok: false, error: "TOO_LARGE" });
    expect(spies.blob.put).not.toHaveBeenCalled();
  });

  test("blob.put failure → UPLOAD_FAILED, no DB write, warning sent", async () => {
    const { deps, spies } = makePhotoDeps({ uploadError: new Error("blob 500") });
    const res = await uploadInstructorPhoto(deps, new Blob(["x"]), VALID_JPEG_META);
    expect(res).toEqual({ ok: false, error: "UPLOAD_FAILED" });
    expect(spies.update).not.toHaveBeenCalled();
    expect(spies.onWarning).toHaveBeenCalled();
  });

  test("old-blob delete failure: upload still succeeds and warning fires", async () => {
    const { deps, spies } = makePhotoDeps({
      existingPhoto: "https://blob.example/old.jpg",
      delError: new Error("404"),
    });
    const res = await uploadInstructorPhoto(deps, new Blob(["x"]), VALID_JPEG_META);
    expect(res.ok).toBe(true);
    expect(spies.onWarning).toHaveBeenCalled();
  });

  test("NOT_FOUND when the instructor row was deleted before the lookup", async () => {
    const { deps, spies } = makePhotoDeps();
    (spies.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await uploadInstructorPhoto(deps, new Blob(["x"]), VALID_JPEG_META);
    expect(res).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(spies.blob.put).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// removeInstructorPhoto

describe("removeInstructorPhoto", () => {
  test("clears DB photo + deletes blob when one exists", async () => {
    const { deps, spies } = makePhotoDeps({ existingPhoto: "https://blob.example/old.jpg" });
    const res = await removeInstructorPhoto(deps);
    expect(res).toEqual({ ok: true });
    expect(spies.update).toHaveBeenCalledWith({
      where: { id: INSTRUCTOR_ID },
      data: { photo: null },
      select: expect.any(Object),
    });
    expect(spies.blob.del).toHaveBeenCalledWith("https://blob.example/old.jpg");
  });

  test("idempotent: no-op when there is no photo to remove", async () => {
    const { deps, spies } = makePhotoDeps({ existingPhoto: null });
    const res = await removeInstructorPhoto(deps);
    expect(res).toEqual({ ok: true });
    expect(spies.update).not.toHaveBeenCalled();
    expect(spies.blob.del).not.toHaveBeenCalled();
  });

  test("BLOB_NOT_CONFIGURED when blob client is null", async () => {
    const { deps } = makePhotoDeps({ blob: null });
    const res = await removeInstructorPhoto(deps);
    expect(res).toEqual({ ok: false, error: "BLOB_NOT_CONFIGURED" });
  });
});
