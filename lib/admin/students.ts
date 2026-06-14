import "server-only";

import { BookingStatus } from "@prisma/client";
import type { Duration, Level, Locale, Role } from "@prisma/client";

import { getActiveCreditCents } from "@/lib/credit/balance";
import type { AdminStudentsFilters } from "@/lib/schemas/admin-students";
import type { Db } from "@/lib/db";

// Pure, dependency-injected loaders for the admin student directory (F-087),
// mirroring `lib/admin/bookings.ts`: the pages under `app/admin/students/` are
// plumbing (parse URL / params → call these → render), while the queries live
// here where Vitest can drive them without `next/headers`.
//
// "Student" = booker, i.e. a `User` with ≥1 `Booking`. There is no `Person`
// model and attendees have no cross-booking identity (F-065 deliberately
// avoided fingerprinting them), so the unit of this directory is the account.

export type AdminStudentsDeps = {
  prisma: Db;
};

// ──────────────────────────────────────────────────────────────────────────
// List

export type AdminStudentRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  locale: Locale;
  bookingsCount: number;
  lastBookingDate: Date | null;
  activeCreditCents: number;
};

export type AdminStudentsPage = {
  rows: AdminStudentRow[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

type StudentWhereInput = {
  bookings: { some: Record<string, never> };
  OR?: Array<{
    name?: { contains: string; mode: "insensitive" };
    email?: { contains: string; mode: "insensitive" };
  }>;
};

function buildWhere(filters: AdminStudentsFilters): StudentWhereInput {
  // `bookings: { some: {} }` restricts the directory to actual bookers; users
  // who only ever signed up (no booking) are not "students" here.
  const where: StudentWhereInput = { bookings: { some: {} } };
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { email: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listStudents(
  deps: AdminStudentsDeps,
  filters: AdminStudentsFilters,
  { now }: { now: Date },
): Promise<AdminStudentsPage> {
  const { prisma } = deps;
  const where = buildWhere(filters);
  const { page, pageSize } = filters;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ name: "asc" }, { email: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, email: true, phone: true, locale: true },
    }),
  ]);

  const ids = users.map((u) => u.id);

  // Per-user aggregates for just this page's bookers, in two grouped queries —
  // never a per-row loop (no N+1). `groupBy` gives count + last class date in
  // one pass; the credit sum reuses the same ACTIVE-and-unexpired predicate as
  // `getActiveCreditCents` (kept here as a batched variant for the list).
  const [bookingAgg, creditAgg] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.booking.groupBy({
            by: ["bookerId"],
            where: { bookerId: { in: ids } },
            _count: { _all: true },
            _max: { date: true },
          }),
          prisma.accountCredit.groupBy({
            by: ["userId"],
            where: { userId: { in: ids }, status: "ACTIVE", expiresAt: { gt: now } },
            _sum: { amountCents: true },
          }),
        ]);

  const bookingsById = new Map(
    bookingAgg.map((b) => [b.bookerId, { count: b._count._all, last: b._max.date }]),
  );
  const creditById = new Map(
    creditAgg.map((c) => [c.userId, c._sum.amountCents ?? 0]),
  );

  const rows: AdminStudentRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    locale: u.locale,
    bookingsCount: bookingsById.get(u.id)?.count ?? 0,
    lastBookingDate: bookingsById.get(u.id)?.last ?? null,
    activeCreditCents: creditById.get(u.id) ?? 0,
  }));

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return { rows, total, totalPages, page, pageSize };
}

// ──────────────────────────────────────────────────────────────────────────
// Profile

export type AdminStudentBooking = {
  id: string;
  date: Date;
  anchorTime: string;
  duration: Duration;
  language: Locale;
  status: BookingStatus;
  totalPriceCents: number;
  instructorName: string | null;
  attendees: { id: string; name: string; level: Level }[];
};

// One instructor note for the read-only timeline. Cross-instructor: unlike
// F-065's `getBookerNoteHistories` (scoped to a single instructorId), the admin
// sees every instructor's note for this booker, so each entry carries its
// author — multi-instructor demands attribution; never hardcode the owner.
export type AdminStudentNote = {
  bookingId: string;
  date: Date;
  setAt: Date | null;
  note: string;
  instructorName: string | null;
};

export type AdminStudentProfile = {
  contact: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    locale: Locale;
    roles: Role[];
    createdAt: Date;
  };
  stats: {
    lessonsCount: number;
    totalSpendCents: number;
    activeCreditCents: number;
  };
  notes: AdminStudentNote[];
  bookings: AdminStudentBooking[];
};

const PROFILE_BOOKING_SELECT = {
  id: true,
  date: true,
  anchorTime: true,
  duration: true,
  language: true,
  status: true,
  totalPriceCents: true,
  instructorNote: true,
  instructorNoteSetAt: true,
  instructor: { select: { user: { select: { name: true } } } },
  attendees: { select: { id: true, name: true, level: true } },
} as const;

// Lifetime spend counts money the school actually earned or will earn: a
// booking only contributes once it is CONFIRMED (paid/holding) or COMPLETED.
// Cancelled / refunded / failed / still-pending bookings are excluded.
const SPEND_STATUSES = new Set<BookingStatus>([
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
]);

/**
 * Full profile for one booker, or `null` if the `User` does not exist.
 *
 * All bookings (every status, newest class first) are fetched once, then the
 * notes timeline and lifetime stats are derived in memory — no second query
 * and no N+1. The active credit balance reuses {@link getActiveCreditCents} so
 * the directory and the dashboard agree on what "active" means.
 */
export async function getStudentProfile(
  deps: AdminStudentsDeps,
  userId: string,
  { now }: { now: Date },
): Promise<AdminStudentProfile | null> {
  const { prisma } = deps;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      locale: true,
      roles: true,
      createdAt: true,
      bookings: {
        orderBy: [{ date: "desc" }, { anchorTime: "desc" }],
        select: PROFILE_BOOKING_SELECT,
      },
    },
  });
  if (!user) return null;

  const activeCreditCents = await getActiveCreditCents(deps, { userId, now });

  const bookings: AdminStudentBooking[] = user.bookings.map((b) => ({
    id: b.id,
    date: b.date,
    anchorTime: b.anchorTime,
    duration: b.duration,
    language: b.language,
    status: b.status,
    totalPriceCents: b.totalPriceCents,
    instructorName: b.instructor.user.name,
    attendees: b.attendees,
  }));

  // Notes: COMPLETED classes that carry a note, newest first (bookings are
  // already date-desc). Note text is intentionally kept off `bookings` above so
  // the bookings-history UI can never accidentally render an internal note.
  const notes: AdminStudentNote[] = user.bookings
    .filter((b) => b.status === BookingStatus.COMPLETED && b.instructorNote !== null)
    .map((b) => ({
      bookingId: b.id,
      date: b.date,
      setAt: b.instructorNoteSetAt,
      note: b.instructorNote as string,
      instructorName: b.instructor.user.name,
    }));

  const lessonsCount = user.bookings.filter(
    (b) => b.status === BookingStatus.COMPLETED,
  ).length;
  const totalSpendCents = user.bookings.reduce(
    (sum, b) => (SPEND_STATUSES.has(b.status) ? sum + b.totalPriceCents : sum),
    0,
  );

  return {
    contact: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      locale: user.locale,
      roles: user.roles,
      createdAt: user.createdAt,
    },
    stats: { lessonsCount, totalSpendCents, activeCreditCents },
    notes,
    bookings,
  };
}
