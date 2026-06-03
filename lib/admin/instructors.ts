import { Role } from "@prisma/client";

import {
  createInstructorSchema,
  deactivateInstructorSchema,
  updateInstructorSchema,
  type CreateInstructorInput,
  type DeactivateInstructorInput,
  type UpdateInstructorInput,
} from "@/lib/schemas/instructor";

// Pure, dependency-injected cores for admin instructor CRUD. They live in
// `lib/` (not the `"use server"` module in `app/`) so Vitest can drive them
// without pulling `next/headers` — the thin wrappers in `app/admin/actions.ts`
// gate on `requireAdmin()` + revalidate around these.
//
// A new instructor is a `User` (roles student+instructor) plus an `Instructor`
// profile, created together in one `$transaction` (CLAUDE.md: multi-table
// mutations are transactional). The user has no credentials row — the person
// claims the account later via magic-link / Google on the same email.

export type AdminInstructorError =
  | "INVALID_INPUT"
  | "EMAIL_TAKEN"
  | "NOT_FOUND";

export type CreateInstructorResult =
  | { ok: true; instructorId: string; userId: string }
  | { ok: false; error: AdminInstructorError };
export type UpdateInstructorResult =
  | { ok: true }
  | { ok: false; error: AdminInstructorError };
export type DeactivateInstructorResult =
  | { ok: true }
  | { ok: false; error: AdminInstructorError };

type InstructorTx = {
  user: {
    create(args: {
      data: {
        email: string;
        name: string;
        roles: Role[];
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  instructor: {
    create(args: {
      data: {
        userId: string;
        bio: string | null;
        languages: CreateInstructorInput["languages"];
        specialties: string[];
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
};

export type AdminInstructorDeps = {
  prisma: {
    user: {
      findUnique(args: {
        where: { email: string };
        select: { id: true };
      }): Promise<{ id: string } | null>;
    };
    instructor: {
      findUnique(args: {
        where: { id: string };
        select: { id: true };
      }): Promise<{ id: string } | null>;
      update(args: {
        where: { id: string };
        data: Record<string, unknown>;
      }): Promise<{ id: string }>;
    };
    $transaction<T>(fn: (tx: InstructorTx) => Promise<T>): Promise<T>;
  };
};

export async function createInstructorWith(
  deps: AdminInstructorDeps,
  input: CreateInstructorInput,
): Promise<CreateInstructorResult> {
  const parsed = createInstructorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { name, email, bio, languages, specialties } = parsed.data;

  const existing = await deps.prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "EMAIL_TAKEN" };

  const { userId, instructorId } = await deps.prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name, roles: [Role.student, Role.instructor] },
      select: { id: true },
    });
    const instructor = await tx.instructor.create({
      data: {
        userId: user.id,
        bio: bio ?? null,
        languages,
        specialties,
      },
      select: { id: true },
    });
    return { userId: user.id, instructorId: instructor.id };
  });

  return { ok: true, instructorId, userId };
}

export async function updateInstructorWith(
  deps: AdminInstructorDeps,
  input: UpdateInstructorInput,
): Promise<UpdateInstructorResult> {
  const parsed = updateInstructorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { instructorId, bio, languages, active } = parsed.data;

  const found = await deps.prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { id: true },
  });
  if (!found) return { ok: false, error: "NOT_FOUND" };

  const data: Record<string, unknown> = {};
  if (bio !== undefined) data.bio = bio;
  if (languages !== undefined) data.languages = languages;
  if (active !== undefined) data.active = active;

  await deps.prisma.instructor.update({ where: { id: instructorId }, data });
  return { ok: true };
}

export async function deactivateInstructorWith(
  deps: AdminInstructorDeps,
  input: DeactivateInstructorInput,
): Promise<DeactivateInstructorResult> {
  const parsed = deactivateInstructorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const found = await deps.prisma.instructor.findUnique({
    where: { id: parsed.data.instructorId },
    select: { id: true },
  });
  if (!found) return { ok: false, error: "NOT_FOUND" };

  // Soft-deactivate only — never hard-delete (FK to bookings/availability).
  await deps.prisma.instructor.update({
    where: { id: parsed.data.instructorId },
    data: { active: false },
  });
  return { ok: true };
}
