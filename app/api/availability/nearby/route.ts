import { NextResponse } from "next/server";

import { getCachedNearby } from "@/lib/booking-engine/cache";
import {
  nearbyQuerySchema,
  parseSearchParams,
  zodErrorToResponse,
} from "@/lib/schemas/availability";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseSearchParams(nearbyQuerySchema, url.searchParams);
  if (!parsed.success) {
    return NextResponse.json(zodErrorToResponse(parsed.error), { status: 400 });
  }

  const { duration, date } = parsed.data;
  const body = await getCachedNearby(duration, date.toISOString());

  return NextResponse.json(body, { status: 200 });
}
