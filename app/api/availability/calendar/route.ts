import { NextResponse } from "next/server";

import { getCachedCalendar } from "@/lib/booking-engine/cache";
import {
  calendarQuerySchema,
  parseSearchParams,
  zodErrorToResponse,
} from "@/lib/schemas/availability";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseSearchParams(calendarQuerySchema, url.searchParams);
  if (!parsed.success) {
    return NextResponse.json(zodErrorToResponse(parsed.error), { status: 400 });
  }

  const { duration, monthFrom, monthTo } = parsed.data;
  const days = await getCachedCalendar(
    duration,
    monthFrom.toISOString(),
    monthTo.toISOString(),
  );

  return NextResponse.json({ days }, { status: 200 });
}
