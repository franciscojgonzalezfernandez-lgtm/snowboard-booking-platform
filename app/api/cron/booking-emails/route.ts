import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { runBookingEmailsCron, type CronDeps } from "@/lib/cron/booking-emails";
import { sendEmail } from "@/lib/email/send-email";
import {
  sendBookingReminderEmailWith,
  type SendBookingReminderDeps,
} from "@/lib/email/send-booking-reminder";
import {
  sendPostClassEmailWith,
  type SendPostClassDeps,
} from "@/lib/email/send-post-class";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const summary = await runBookingEmailsCron({
    prisma: prisma as unknown as CronDeps["prisma"],
    sendReminder: sendBookingReminderEmailWith,
    sendPostClass: sendPostClassEmailWith,
    reminderDeps: {
      prisma: prisma as unknown as SendBookingReminderDeps["prisma"],
      send: sendEmail,
    },
    postClassDeps: {
      prisma: prisma as unknown as SendPostClassDeps["prisma"],
      send: sendEmail,
      googlePlaceId: process.env.GOOGLE_PLACE_ID ?? null,
      tipUrl: process.env.INSTRUCTOR_TIP_URL ?? null,
    },
    now: new Date(),
  });

  return NextResponse.json({ ok: true, ...summary });
}
