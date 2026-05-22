import { NextResponse } from "next/server";

import { getCachedSlots } from "@/lib/booking-engine/cache";
import {
  parseSearchParams,
  slotsQuerySchema,
  zodErrorToResponse,
} from "@/lib/schemas/availability";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseSearchParams(slotsQuerySchema, url.searchParams);
  if (!parsed.success) {
    return NextResponse.json(zodErrorToResponse(parsed.error), { status: 400 });
  }

  const { duration, date } = parsed.data;
  const slots = await getCachedSlots(duration, date.toISOString());

  return NextResponse.json(slots, { status: 200 });
}
