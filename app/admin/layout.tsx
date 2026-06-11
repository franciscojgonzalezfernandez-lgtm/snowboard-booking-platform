import Link from "next/link";

import { signOutAction } from "@/lib/auth/actions";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate the whole area server-side: anonymous → login, non-admin → 404.
  await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-6 border-b border-input px-6 py-4">
        <div className="flex items-center gap-8">
          <Link
            href="/admin"
            data-testid="admin-brand"
            className="font-display text-sm font-bold uppercase tracking-[0.22em]"
          >
            Ride Flumserberg · Admin
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/admin"
              data-testid="admin-nav-calendar"
              className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
            >
              Calendar
            </Link>
            <Link
              href="/admin/bookings"
              data-testid="admin-nav-bookings"
              className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
            >
              Bookings
            </Link>
            <Link
              href="/admin/instructors"
              data-testid="admin-nav-instructors"
              className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
            >
              Instructors
            </Link>
            <Link
              href="/admin/cancel-day"
              data-testid="admin-nav-cancel-day"
              className="text-xs font-bold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
            >
              Cancel day
            </Link>
          </nav>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            data-testid="admin-sign-out"
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
