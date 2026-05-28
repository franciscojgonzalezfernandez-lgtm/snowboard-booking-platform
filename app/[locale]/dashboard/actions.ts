"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { userPhoneSchema } from "@/lib/schemas/user-phone";

export type UpdateUserPhoneResult =
  | { ok: true; phone: string | null }
  | { ok: false; error: "UNAUTHORIZED" | "INVALID_PHONE" | "SERVER_ERROR" };

/**
 * F-064b: update (or remove) the signed-in user's phone from the dashboard.
 * An empty string removes the number. Re-resolves the session server-side and
 * re-validates with the shared {@link userPhoneSchema} — never trusts the
 * client. No-ops when the value is unchanged.
 */
export async function updateUserPhone(
  rawPhone: string,
): Promise<UpdateUserPhoneResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { ok: false, error: "UNAUTHORIZED" };

  const parsed = userPhoneSchema.safeParse(rawPhone);
  if (!parsed.success) return { ok: false, error: "INVALID_PHONE" };
  const phone = parsed.data; // string | null

  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });
  // Save without changes is a no-op — skip the write + revalidate.
  if (current?.phone === phone) return { ok: true, phone };

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { phone },
    });
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: "SERVER_ERROR" };
  }

  revalidatePath("/[locale]/dashboard", "page");
  return { ok: true, phone };
}
