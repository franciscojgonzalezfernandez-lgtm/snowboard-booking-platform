import { revalidatePath } from "next/cache";

/**
 * F-081: bust the cached RSC payloads of every surface that shows a booking's
 * status after a no-show re-flip. Shared by the admin (`app/admin/actions.ts`)
 * and instructor (`app/instructor/actions.ts`) wrappers so the two can't drift
 * — the same booking can be re-flipped from either, and whoever did it should
 * see all four surfaces fresh on their next navigation (notably an
 * admin+instructor moving between `/instructor` and `/admin/bookings`).
 *
 * Note: this only refreshes the *acting* user's client Router Cache. The admin
 * pages are session-dynamic and read straight from Prisma, so a *different*
 * user's already-open tab still needs its own refetch — that is not something
 * `revalidatePath` can reach.
 */
export function revalidateAfterNoShow(bookingId: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/instructor");
}
