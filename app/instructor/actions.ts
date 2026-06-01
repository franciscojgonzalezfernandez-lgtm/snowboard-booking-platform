"use server";

import { revalidatePath } from "next/cache";

import { requireInstructor } from "@/lib/auth/require-instructor";
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

// Thin `"use server"` wrappers: resolve + re-check the instructor (never trust a
// client-sent role), delegate to the dependency-injected cores in
// lib/instructor/availability-actions.ts, then revalidate the instructor views.

function instructorDeps(instructorId: string): AvailabilityDeps {
  return {
    prisma: prisma as unknown as AvailabilityDeps["prisma"],
    instructorId,
  };
}

function revalidateInstructor() {
  revalidatePath("/instructor");
  revalidatePath("/instructor/calendar");
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
