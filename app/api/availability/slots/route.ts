import { NextResponse } from "next/server";
import { computeSlotsForDate } from "@/lib/booking-engine";
import { loadEngineContext } from "@/lib/booking-engine/load-context";
import { prisma } from "@/lib/db";
import {
  parseSearchParams,
  slotsQuerySchema,
  zodErrorToResponse,
} from "@/lib/schemas/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseSearchParams(slotsQuerySchema, url.searchParams);
  if (!parsed.success) {
    return NextResponse.json(zodErrorToResponse(parsed.error), { status: 400 });
  }

  const { duration, date } = parsed.data;
  const ctx = await loadEngineContext(prisma, { from: date, to: date });
  const slots = computeSlotsForDate(ctx, { duration, date });

  return NextResponse.json(slots, { status: 200 });
}
