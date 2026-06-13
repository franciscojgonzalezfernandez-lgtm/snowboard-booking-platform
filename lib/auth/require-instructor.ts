import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type InstructorContext = {
  userId: string;
  instructorId: string;
};

/**
 * Server-side guard for the EN-only `/instructor` area (outside `[locale]`).
 *
 * Anonymous visitors are sent to the English login. Authenticated users who
 * are not instructors get a 404 (`notFound`) rather than a redirect loop —
 * exposing the area's existence to a non-instructor adds nothing.
 *
 * The role is re-checked against the database on every call (never trust a
 * client-sent role, per the security checklist) and we require an actual
 * `Instructor` profile so the caller always gets a usable `instructorId`.
 *
 * Note: `?next=/instructor` is intentionally omitted from the login redirect —
 * `sanitizeNext` only honours locale-prefixed targets, so it would be dropped.
 * Proper return-to for `/instructor` + `/admin` is a follow-up (see F-076).
 */
export async function requireInstructor(): Promise<InstructorContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/en/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      roles: true,
      instructor: { select: { id: true } },
    },
  });

  if (!user?.roles.includes("instructor") || !user.instructor) {
    notFound();
  }

  return { userId: session.user.id, instructorId: user.instructor.id };
}
