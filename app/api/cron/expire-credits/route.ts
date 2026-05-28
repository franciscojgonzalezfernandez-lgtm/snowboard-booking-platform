import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import {
  runExpireCreditsCron,
  type ExpireCreditsDeps,
} from "@/lib/credit/expire";
import { prisma } from "@/lib/db";

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

  const summary = await runExpireCreditsCron({
    prisma: prisma as unknown as ExpireCreditsDeps["prisma"],
    now: new Date(),
  });

  if (summary.expired > 0) {
    Sentry.addBreadcrumb({
      category: "cron.expire-credits",
      level: "info",
      message: `expired ${summary.expired} account credit(s)`,
      data: { expired: summary.expired },
    });
  }

  return NextResponse.json({ ok: true, ...summary });
}
