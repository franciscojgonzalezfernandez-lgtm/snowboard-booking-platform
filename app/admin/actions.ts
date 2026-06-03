"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { AVAILABILITY_TAGS } from "@/lib/booking-engine/cache";
import { prisma } from "@/lib/db";
import {
  createInstructorWith,
  deactivateInstructorWith,
  updateInstructorWith,
  type AdminInstructorDeps,
  type CreateInstructorResult,
  type DeactivateInstructorResult,
  type UpdateInstructorResult,
} from "@/lib/admin/instructors";
import {
  blockAvailabilityWindowWith,
  clearAvailabilityWith,
  openAvailabilityRangeWith,
  type AvailabilityDeps,
  type BlockWindowResult,
  type ClearResult,
  type OpenRangeResult,
} from "@/lib/instructor/availability-actions";
import type {
  CreateInstructorInput,
  UpdateInstructorInput,
} from "@/lib/schemas/instructor";

// Thin `"use server"` wrappers for the admin panel. Every action re-checks the
// admin role server-side (never trust a client-sent role). The availability
// actions mirror `app/instructor/actions.ts` but bind the *selected* instructor
// (id comes from the client) instead of the session — so the id is validated
// against an active Instructor before the dependency-injected cores run.

function availabilityDeps(instructorId: string): AvailabilityDeps {
  return {
    prisma: prisma as unknown as AvailabilityDeps["prisma"],
    instructorId,
  };
}

function instructorDeps(): AdminInstructorDeps {
  return { prisma: prisma as unknown as AdminInstructorDeps["prisma"] };
}

// A successful availability mutation must bust the booker-side availability
// cache and refresh both the admin and the affected instructor's views.
function revalidateAvailability() {
  revalidatePath("/admin");
  revalidatePath("/instructor");
  revalidatePath("/instructor/calendar");
  revalidatePath("/instructor/availability");
  revalidateTag(AVAILABILITY_TAGS.root);
}

async function activeInstructorExists(instructorId: string): Promise<boolean> {
  const found = await prisma.instructor.findFirst({
    where: { id: instructorId, active: true },
    select: { id: true },
  });
  return found !== null;
}

export async function adminOpenAvailabilityRange(input: {
  instructorId: string;
  fromDate: string;
  toDate: string;
}): Promise<OpenRangeResult> {
  await requireAdmin();
  if (!(await activeInstructorExists(input.instructorId))) {
    return { ok: false, error: "NOT_FOUND" };
  }
  const result = await openAvailabilityRangeWith(
    availabilityDeps(input.instructorId),
    { fromDate: input.fromDate, toDate: input.toDate },
  );
  if (result.ok) revalidateAvailability();
  return result;
}

export async function adminBlockAvailabilityWindow(input: {
  instructorId: string;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<BlockWindowResult> {
  await requireAdmin();
  if (!(await activeInstructorExists(input.instructorId))) {
    return { ok: false, error: "NOT_FOUND" };
  }
  const result = await blockAvailabilityWindowWith(
    availabilityDeps(input.instructorId),
    { date: input.date, startTime: input.startTime, endTime: input.endTime },
  );
  if (result.ok) revalidateAvailability();
  return result;
}

export async function adminClearAvailability(input: {
  instructorId: string;
  blockId: string;
}): Promise<ClearResult> {
  await requireAdmin();
  if (!(await activeInstructorExists(input.instructorId))) {
    return { ok: false, error: "NOT_FOUND" };
  }
  const result = await clearAvailabilityWith(availabilityDeps(input.instructorId), {
    blockId: input.blockId,
  });
  if (result.ok) revalidateAvailability();
  return result;
}

export async function createInstructor(
  input: CreateInstructorInput,
): Promise<CreateInstructorResult> {
  await requireAdmin();
  const result = await createInstructorWith(instructorDeps(), input);
  if (result.ok) {
    revalidatePath("/admin/instructors");
    revalidatePath("/admin");
    revalidateTag(AVAILABILITY_TAGS.root);
  }
  return result;
}

export async function updateInstructor(
  input: UpdateInstructorInput,
): Promise<UpdateInstructorResult> {
  await requireAdmin();
  const result = await updateInstructorWith(instructorDeps(), input);
  if (result.ok) {
    revalidatePath("/admin/instructors");
    revalidatePath("/admin");
    revalidateTag(AVAILABILITY_TAGS.root);
  }
  return result;
}

export async function deactivateInstructor(input: {
  instructorId: string;
}): Promise<DeactivateInstructorResult> {
  await requireAdmin();
  const result = await deactivateInstructorWith(instructorDeps(), input);
  if (result.ok) {
    revalidatePath("/admin/instructors");
    revalidatePath("/admin");
    revalidateTag(AVAILABILITY_TAGS.root);
  }
  return result;
}
