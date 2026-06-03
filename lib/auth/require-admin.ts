import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type AdminContext = {
  userId: string;
};

/**
 * Server-side guard for the EN-only `/admin` area (outside `[locale]`).
 *
 * Mirrors {@link import("./require-instructor").requireInstructor}: anonymous
 * visitors are sent to the English login; authenticated users who are not
 * admins get a 404 (`notFound`) rather than a redirect loop — exposing the
 * area's existence to a non-admin adds nothing.
 *
 * The role is re-checked against the database on every call (never trust a
 * client-sent role, per the security checklist).
 */
export async function requireAdmin(): Promise<AdminContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/en/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { roles: true },
  });

  if (!user?.roles.includes("admin")) {
    notFound();
  }

  return { userId: session.user.id };
}
