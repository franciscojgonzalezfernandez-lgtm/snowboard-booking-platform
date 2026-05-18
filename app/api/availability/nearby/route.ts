import { NextResponse } from "next/server";
import { DEFAULT_WINDOW_DAYS, findNearbyDates } from "@/lib/booking-engine";
import { addDays } from "@/lib/booking-engine/time";
import { loadEngineContext } from "@/lib/booking-engine/load-context";
import { prisma } from "@/lib/db";
import {
  nearbyQuerySchema,
  parseSearchParams,
  zodErrorToResponse,
} from "@/lib/schemas/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseSearchParams(nearbyQuerySchema, url.searchParams);
  if (!parsed.success) {
    return NextResponse.json(zodErrorToResponse(parsed.error), { status: 400 });
  }

  const { duration, date } = parsed.data;
  const ctx = await loadEngineContext(prisma, {
    from: addDays(date, -DEFAULT_WINDOW_DAYS),
    to: addDays(date, DEFAULT_WINDOW_DAYS),
  });
  const dates = findNearbyDates(ctx, { duration, date });

  return NextResponse.json({ date: parsed.data.date.toISOString().slice(0, 10), dates }, { status: 200 });
}
