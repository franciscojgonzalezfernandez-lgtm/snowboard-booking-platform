import { timingSafeEqual } from "node:crypto";

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
  if (!secret) {
    // Misconfiguration: without the secret every invocation 401s forever and
    // credits never expire. Surface it instead of failing silently.
    Sentry.captureMessage(
      "expire-credits cron: CRON_SECRET is not set — endpoint will reject all calls",
      "warning",
    );
    return false;
  }
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // Constant-time compare to avoid leaking the secret via response timing.
  // timingSafeEqual requires equal-length buffers, so gate on length first.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
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
  } catch (error) {
    // A DB failure here must not 500 silently — the sweep is the only thing
    // keeping AccountCredit.status honest. Report and return a clean error.
    Sentry.captureException(error);
    return NextResponse.json(
      { ok: false, error: "EXPIRE_CREDITS_FAILED" },
      { status: 500 },
    );
  }
}
