import { NextResponse } from "next/server";
import { computeCalendar } from "@/lib/booking-engine";
import { loadEngineContext } from "@/lib/booking-engine/load-context";
import { prisma } from "@/lib/db";
import {
  calendarQuerySchema,
  parseSearchParams,
  zodErrorToResponse,
} from "@/lib/schemas/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseSearchParams(calendarQuerySchema, url.searchParams);
  if (!parsed.success) {
    return NextResponse.json(zodErrorToResponse(parsed.error), { status: 400 });
  }

  const { duration, monthFrom, monthTo } = parsed.data;
  const ctx = await loadEngineContext(prisma, { from: monthFrom, to: monthTo });
  const days = computeCalendar(ctx, { duration, monthFrom, monthTo });

  return NextResponse.json({ days }, { status: 200 });
}
