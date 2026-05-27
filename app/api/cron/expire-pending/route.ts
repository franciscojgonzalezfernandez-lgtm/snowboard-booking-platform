import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  runExpirePendingCron,
  type ExpirePendingDeps,
} from "@/lib/cron/expire-pending";

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

  const summary = await runExpirePendingCron({
    prisma: prisma as unknown as ExpirePendingDeps["prisma"],
    now: new Date(),
  });

  return NextResponse.json({ ok: true, ...summary });
}
