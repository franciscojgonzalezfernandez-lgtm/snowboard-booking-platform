"use server";

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
import type { CreateAvailabilityBlockInput } from "@/lib/schemas/availability-block";

// Thin `"use server"` wrappers: resolve + re-check the instructor (never trust a
// client-sent role), delegate to the dependency-injected cores in
// lib/instructor/, then revalidate the instructor views.
//
// Two surfaces share this file:
// - F-083 calendar (open/block/clear range) → availability-actions.ts
// - F-072 availability page (create/delete block) → availability-block.ts
//
// Booker-side availability is cached (`lib/booking-engine/cache.ts`), so a
// successful mutation must bust `AVAILABILITY_TAGS.root` — otherwise a freshly
// created block doesn't show up on `/reservar` until the 30-min revalidate.

function instructorDeps(instructorId: string): AvailabilityDeps {
  return {
    prisma: prisma as unknown as AvailabilityDeps["prisma"],
    instructorId,
  };
}

function revalidateInstructor() {
  revalidatePath("/instructor");
  revalidatePath("/instructor/calendar");
  revalidatePath("/instructor/availability");
  revalidateTag(AVAILABILITY_TAGS.root);
}

export async function openAvailabilityRange(input: {
  fromDate: string;
  toDate: string;
}): Promise<OpenRangeResult> {
  const { instructorId } = await requireInstructor();
  const result = await openAvailabilityRangeWith(instructorDeps(instructorId), input);
  if (result.ok) revalidateInstructor();
  return result;
}

export async function blockAvailabilityWindow(input: {
  date: string;
  startTime: string;
  endTime: string;
}): Promise<BlockWindowResult> {
  const { instructorId } = await requireInstructor();
  const result = await blockAvailabilityWindowWith(instructorDeps(instructorId), input);
  if (result.ok) revalidateInstructor();
  return result;
}

export async function clearAvailability(input: {
  blockId: string;
}): Promise<ClearResult> {
  const { instructorId } = await requireInstructor();
  const result = await clearAvailabilityWith(instructorDeps(instructorId), input);
  if (result.ok) revalidateInstructor();
  return result;
}

export async function createAvailabilityBlock(
  input: CreateAvailabilityBlockInput,
): Promise<CreateBlockResult> {
  const { instructorId } = await requireInstructor();
  const result = await createInstructorAvailabilityBlock(
    { prisma, instructorId, now: new Date() },
    input,
  );
  if (result.ok) {
    revalidatePath("/instructor/availability");
    revalidatePath("/instructor");
    revalidateTag(AVAILABILITY_TAGS.root);
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
    revalidatePath("/instructor/availability");
    revalidatePath("/instructor");
    revalidateTag(AVAILABILITY_TAGS.root);
  }
  return result;
}
