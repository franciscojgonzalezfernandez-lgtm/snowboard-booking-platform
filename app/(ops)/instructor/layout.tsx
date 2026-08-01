import Link from "next/link";

import { signOutAction } from "@/lib/auth/actions";
import { requireInstructor } from "@/lib/auth/require-instructor";

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate the whole area server-side: anonymous → login, non-instructor → 404.
  await requireInstructor();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-input px-6 py-4">
        <Link
          href="/instructor"
          data-testid="instructor-brand"
          className="font-display text-sm font-bold uppercase tracking-[0.22em]"
        >
          Ride Flumserberg · Instructor
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            data-testid="instructor-sign-out"
            className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </form>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
