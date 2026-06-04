import { describe, expect, test, vi } from "vitest";
import { Locale, Role } from "@prisma/client";

import {
  createInstructorWith,
  deactivateInstructorWith,
  updateInstructorWith,
  type AdminInstructorDeps,
} from "./instructors";

function makeDeps(overrides?: {
  existingUser?:
    | { id: string; roles: Role[]; instructor: { id: string } | null }
    | null;
  instructor?: { id: string } | null;
}) {
  const userCreate = vi.fn(async () => ({ id: "user_new" }));
  const userUpdate = vi.fn(async ({ where }: { where: { id: string } }) => ({
    id: where.id,
  }));
  const instructorCreate = vi.fn(async () => ({ id: "inst_new" }));
  const instructorUpdate = vi.fn(async ({ where }: { where: { id: string } }) => ({
    id: where.id,
  }));
  const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      user: { create: userCreate, update: userUpdate },
      instructor: { create: instructorCreate },
    }),
  );

  const deps: AdminInstructorDeps = {
    prisma: {
      user: {
        findUnique: vi.fn(async () =>
          overrides?.existingUser === undefined ? null : overrides.existingUser,
        ),
      },
      instructor: {
        findUnique: vi.fn(async () =>
          overrides?.instructor === undefined ? null : overrides.instructor,
        ),
        update: instructorUpdate,
      },
      $transaction,
    } as unknown as AdminInstructorDeps["prisma"],
  };
  return {
    deps,
    spies: { userCreate, userUpdate, instructorCreate, instructorUpdate, $transaction },
  };
}

describe("createInstructorWith", () => {
  test("creates user + instructor in one transaction", async () => {
    const { deps, spies } = makeDeps();
    const result = await createInstructorWith(deps, {
      name: "Jane Coach",
      email: "Jane@Example.com",
      bio: "Rides powder.",
      languages: [Locale.en, Locale.de],
      specialties: ["freestyle"],
    });

    expect(result).toEqual({ ok: true, instructorId: "inst_new", userId: "user_new" });
    expect(spies.$transaction).toHaveBeenCalledOnce();
    // Email normalised to lowercase, roles include instructor.
    expect(spies.userCreate).toHaveBeenCalledWith({
      data: {
        email: "jane@example.com",
        name: "Jane Coach",
        roles: [Role.student, Role.instructor],
      },
      select: { id: true },
    });
    expect(spies.instructorCreate).toHaveBeenCalledWith({
      data: {
        userId: "user_new",
        bio: "Rides powder.",
        languages: [Locale.en, Locale.de],
        specialties: ["freestyle"],
      },
      select: { id: true },
    });
  });

  test("promotes an existing non-instructor user (adds role + profile, no new user)", async () => {
    const { deps, spies } = makeDeps({
      existingUser: { id: "user_existing", roles: [Role.student], instructor: null },
    });
    const result = await createInstructorWith(deps, {
      name: "Existing Person",
      email: "existing@example.com",
      languages: [Locale.de],
    });

    expect(result).toEqual({
      ok: true,
      instructorId: "inst_new",
      userId: "user_existing",
    });
    expect(spies.userCreate).not.toHaveBeenCalled();
    expect(spies.userUpdate).toHaveBeenCalledWith({
      where: { id: "user_existing" },
      data: { roles: [Role.student, Role.instructor] },
    });
    expect(spies.instructorCreate).toHaveBeenCalledWith({
      data: { userId: "user_existing", bio: null, languages: [Locale.de], specialties: [] },
      select: { id: true },
    });
  });

  test("rejects when the user is already an instructor, without touching the transaction", async () => {
    const { deps, spies } = makeDeps({
      existingUser: {
        id: "user_existing",
        roles: [Role.student, Role.instructor],
        instructor: { id: "inst_existing" },
      },
    });
    const result = await createInstructorWith(deps, {
      name: "Dup",
      email: "dup@example.com",
      languages: [Locale.en],
    });
    expect(result).toEqual({ ok: false, error: "ALREADY_INSTRUCTOR" });
    expect(spies.$transaction).not.toHaveBeenCalled();
  });

  test("rejects invalid email", async () => {
    const { deps } = makeDeps();
    const result = await createInstructorWith(deps, {
      name: "Bad",
      email: "not-an-email",
      languages: [Locale.en],
    });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("rejects when no language selected", async () => {
    const { deps } = makeDeps();
    const result = await createInstructorWith(deps, {
      name: "NoLang",
      email: "nolang@example.com",
      languages: [],
    });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });
});

describe("updateInstructorWith", () => {
  test("updates only the provided fields", async () => {
    const { deps, spies } = makeDeps({ instructor: { id: "inst_1" } });
    const result = await updateInstructorWith(deps, {
      instructorId: "inst_1",
      active: false,
    });
    expect(result).toEqual({ ok: true });
    expect(spies.instructorUpdate).toHaveBeenCalledWith({
      where: { id: "inst_1" },
      data: { active: false },
    });
  });

  test("rejects unknown instructor", async () => {
    const { deps, spies } = makeDeps({ instructor: null });
    const result = await updateInstructorWith(deps, {
      instructorId: "missing",
      bio: "x",
    });
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(spies.instructorUpdate).not.toHaveBeenCalled();
  });
});

describe("deactivateInstructorWith", () => {
  test("soft-deactivates (active=false), never deletes", async () => {
    const { deps, spies } = makeDeps({ instructor: { id: "inst_1" } });
    const result = await deactivateInstructorWith(deps, { instructorId: "inst_1" });
    expect(result).toEqual({ ok: true });
    expect(spies.instructorUpdate).toHaveBeenCalledWith({
      where: { id: "inst_1" },
      data: { active: false },
    });
  });

  test("rejects unknown instructor", async () => {
    const { deps } = makeDeps({ instructor: null });
    const result = await deactivateInstructorWith(deps, { instructorId: "missing" });
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});
