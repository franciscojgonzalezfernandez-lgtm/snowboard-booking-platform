import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { durationMinutes } from "@/lib/booking-engine/duration";
import { setUtcTime } from "@/lib/booking-engine/time";
import { buildBookingIcs } from "@/lib/ics/build-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORGANIZER_EMAIL = "booking@rideflumserberg.ch";
const ORGANIZER_NAME = "Ride Flumserberg";
const LOCATION = "Flumserberg, Switzerland";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      bookerId: true,
      date: true,
      anchorTime: true,
      duration: true,
      icsUid: true,
      booker: { select: { name: true, email: true } },
      instructor: { select: { user: { select: { name: true } } } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (booking.bookerId !== session.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const startUtc = setUtcTime(booking.date, booking.anchorTime);
  const instructorName =
    booking.instructor.user.name ?? "Ride Flumserberg instructor";
  const bookerName =
    booking.booker.name ?? booking.booker.email.split("@")[0]!;

  const ics = buildBookingIcs({
    uid: booking.icsUid,
    title: `Snowboard lesson · ${instructorName}`,
    startUtc,
    durationMinutes: durationMinutes(booking.duration),
    location: LOCATION,
    description: `Ride Flumserberg booking ${booking.id}.`,
    organizerName: ORGANIZER_NAME,
    organizerEmail: ORGANIZER_EMAIL,
    attendeeName: bookerName,
    attendeeEmail: booking.booker.email,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8; method=REQUEST",
      "Content-Disposition": `attachment; filename="booking-${booking.id}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
