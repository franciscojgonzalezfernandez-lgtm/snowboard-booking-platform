import { BookingStatus } from "@prisma/client";

import {
  instructorNoteSchema,
  type InstructorNoteInput,
} from "@/lib/schemas/instructor-note";

/**
 * F-065: instructor feedback per booking + cross-booking history by booker.
 *
 * Pure server logic; the action layer (`app/instructor/actions.ts`) adds
 * `requireInstructor()` + `revalidatePath('/instructor')`. The note is
 * internal-only — it is never surfaced on the booker's `/dashboard`.
 */

export type SetInstructorNoteResult =
  | { ok: true; cleared: boolean; setAt: Date | null }
  | {
      ok: false;
      error: "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN" | "NOT_COMPLETED";
    };

type SetNotePrismaSurface = {
  booking: {
    findUnique(args: {
      where: { id: string };
      select: { instructorId: true; status: true };
    }): Promise<{ instructorId: string; status: BookingStatus } | null>;
    update(args: {
      where: { id: string };
      data: { instructorNote: string | null; instructorNoteSetAt: Date | null };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
};

export type SetInstructorNoteDeps = {
  prisma: SetNotePrismaSurface;
  instructorId: string;
  now?: Date;
};

/**
 * Persist (or clear) the note on one booking. Guards, in order:
 *   - Zod-invalid input            → INVALID_INPUT
 *   - booking does not exist       → NOT_FOUND
 *   - booking owned by another     → FORBIDDEN
 *   - booking not COMPLETED        → NOT_COMPLETED (no-op; notes only make
 *                                     sense once the class has happened)
 *
 * A `null` or whitespace-only note clears both columns together so a stale
 * `instructorNoteSetAt` never lingers without text.
 */
export async function setInstructorNoteWith(
  deps: SetInstructorNoteDeps,
  input: InstructorNoteInput,
): Promise<SetInstructorNoteResult> {
  const parsed = instructorNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  const { bookingId, note } = parsed.data;

  const booking = await deps.prisma.booking.findUnique({
    where: { id: bookingId },
    select: { instructorId: true, status: true },
  });
  if (!booking) {
    return { ok: false, error: "NOT_FOUND" };
  }
  if (booking.instructorId !== deps.instructorId) {
    return { ok: false, error: "FORBIDDEN" };
  }
  if (booking.status !== BookingStatus.COMPLETED) {
    return { ok: false, error: "NOT_COMPLETED" };
  }

  const trimmed = note?.trim() ?? "";
  const value = trimmed.length === 0 ? null : trimmed;
  const setAt = value === null ? null : (deps.now ?? new Date());

  await deps.prisma.booking.update({
    where: { id: bookingId },
    data: { instructorNote: value, instructorNoteSetAt: setAt },
    select: { id: true },
  });

  return { ok: true, cleared: value === null, setAt };
}

// ──────────────────────────────────────────────────────────────────────────
// Booker history: previous COMPLETED bookings (with a note) for each booker.

export const BOOKER_HISTORY_LIMIT = 10;

export type BookerNoteHistoryEntry = {
  bookingId: string;
  bookerId: string;
  date: Date;
  note: string;
  setAt: Date | null;
};

type HistoryRow = {
  id: string;
  bookerId: string;
  date: Date;
  instructorNote: string | null;
  instructorNoteSetAt: Date | null;
};

type HistoryPrismaSurface = {
  booking: {
    findMany(args: {
      where: {
        instructorId: string;
        bookerId: { in: string[] };
        status: BookingStatus;
        instructorNote: { not: null };
      };
      orderBy: { date: "desc" };
      select: {
        id: true;
        bookerId: true;
        date: true;
        instructorNote: true;
        instructorNoteSetAt: true;
      };
    }): Promise<HistoryRow[]>;
  };
};

export type BookerHistoryDeps = {
  prisma: HistoryPrismaSurface;
  instructorId: string;
};

/**
 * Batch-load the note history for many bookers in one query and bucket it by
 * `bookerId`, newest first, capped at {@link BOOKER_HISTORY_LIMIT} per booker.
 * Scoped to `instructorId` so an instructor only ever sees their own private
 * notes (matters once the platform is multi-instructor).
 */
export async function getBookerNoteHistories(
  deps: BookerHistoryDeps,
  bookerIds: string[],
): Promise<Map<string, BookerNoteHistoryEntry[]>> {
  const byBooker = new Map<string, BookerNoteHistoryEntry[]>();
  const unique = Array.from(new Set(bookerIds));
  if (unique.length === 0) {
    return byBooker;
  }

  const rows = await deps.prisma.booking.findMany({
    where: {
      instructorId: deps.instructorId,
      bookerId: { in: unique },
      status: BookingStatus.COMPLETED,
      instructorNote: { not: null },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      bookerId: true,
      date: true,
      instructorNote: true,
      instructorNoteSetAt: true,
    },
  });

  for (const row of rows) {
    // `instructorNote: { not: null }` already filters DB-side; this narrows the
    // type and is a cheap belt-and-braces guard.
    if (row.instructorNote === null) continue;
    const list = byBooker.get(row.bookerId) ?? [];
    if (list.length >= BOOKER_HISTORY_LIMIT) continue;
    list.push({
      bookingId: row.id,
      bookerId: row.bookerId,
      date: row.date,
      note: row.instructorNote,
      setAt: row.instructorNoteSetAt,
    });
    byBooker.set(row.bookerId, list);
  }

  return byBooker;
}
