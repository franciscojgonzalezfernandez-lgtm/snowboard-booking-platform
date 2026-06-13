import { Role } from "@prisma/client";

import {
  createInstructorSchema,
  deactivateInstructorSchema,
  updateInstructorSchema,
  type CreateInstructorInput,
  type DeactivateInstructorInput,
  type UpdateInstructorInput,
} from "@/lib/schemas/instructor";
import type { Db } from "@/lib/db";
import type { Empty, Result } from "@/lib/types/result";

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
  | "ALREADY_INSTRUCTOR"
  | "NOT_FOUND";

export type CreateInstructorResult = Result<
  { instructorId: string; userId: string },
  AdminInstructorError
>;
export type UpdateInstructorResult = Result<Empty, AdminInstructorError>;
export type DeactivateInstructorResult = Result<Empty, AdminInstructorError>;


export type AdminInstructorDeps = {
  prisma: Db;
};

/** Append `instructor` without dropping existing roles or duplicating it. */
function withInstructorRole(roles: Role[]): Role[] {
  return roles.includes(Role.instructor) ? roles : [...roles, Role.instructor];
}

export async function createInstructorWith(
  deps: AdminInstructorDeps,
  input: CreateInstructorInput,
): Promise<CreateInstructorResult> {
  const parsed = createInstructorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { name, email, bio, languages, specialties } = parsed.data;

  const existing = await deps.prisma.user.findUnique({
    where: { email },
    select: { id: true, roles: true, instructor: { select: { id: true } } },
  });

  // Already a coach — nothing to do, surface it so the admin isn't confused.
  if (existing?.instructor) {
    return { ok: false, error: "ALREADY_INSTRUCTOR" };
  }

  const { userId, instructorId } = await deps.prisma.$transaction(async (tx) => {
    // Existing user (e.g. a student or someone who registered earlier): promote
    // in place by adding the `instructor` role + attaching an Instructor
    // profile, rather than rejecting on the unique email.
    const userId = existing
      ? (
          await tx.user.update({
            where: { id: existing.id },
            data: { roles: withInstructorRole(existing.roles) },
          })
        ).id
      : (
          await tx.user.create({
            data: { email, name, roles: [Role.student, Role.instructor] },
            select: { id: true },
          })
        ).id;

    const instructor = await tx.instructor.create({
      data: { userId, bio: bio ?? null, languages, specialties },
      select: { id: true },
    });
    return { userId, instructorId: instructor.id };
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
