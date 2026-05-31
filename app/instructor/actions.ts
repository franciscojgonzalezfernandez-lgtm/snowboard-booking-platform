"use server";

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
import type { CreateAvailabilityBlockInput } from "@/lib/schemas/availability-block";

/**
 * F-072: thin Server Action wrappers. All policy + DB writes live in
 * `lib/instructor/availability-block.ts`; this file is just session +
 * cache plumbing.
 *
 * Booker-side availability is cached (`lib/booking-engine/cache.ts`), so a
 * successful mutation must bust `AVAILABILITY_TAGS.root` — otherwise a freshly
 * created block doesn't show up on `/reservar` until the 30-min revalidate.
 */

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
