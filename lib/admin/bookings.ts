import type { BookingStatus, Duration, Locale } from "@prisma/client";

import type { AdminBookingsFilters } from "@/lib/schemas/admin-bookings";

// Pure, dependency-injected loader for the admin bookings list (F-077).
// Lives in `lib/` so Vitest can drive it without `next/headers` — the page
// in `app/admin/bookings/page.tsx` is plumbing (parses URL → calls this →
// renders rows).
//
// `where` is composed from the parsed filters; unspecified filters omit
// their clause so the index plan stays clean. Count + page query run in
// parallel via Promise.all (same `where`).

export type AdminBookingRow = {
  id: string;
  date: Date;
  anchorTime: string;
  duration: Duration;
  language: Locale;
  status: BookingStatus;
  totalPriceCents: number;
  chargeAmountCents: number | null;
  creditsAppliedCents: number | null;
  createdAt: Date;
  booker: { name: string | null; email: string };
  instructor: { user: { name: string | null } };
  attendees: { id: string }[];
};

export type AdminBookingsPage = {
  rows: AdminBookingRow[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

type BookingWhereInput = {
  status?: BookingStatus;
  instructorId?: string;
  date?: { gte?: Date; lte?: Date };
  OR?: Array<{
    booker?: {
      name?: { contains: string; mode: "insensitive" };
      email?: { contains: string; mode: "insensitive" };
    };
  }>;
};

type BookingDelegate = {
  count(args: { where: BookingWhereInput }): Promise<number>;
  findMany(args: {
    where: BookingWhereInput;
    orderBy: Array<Record<string, "asc" | "desc">>;
    skip: number;
    take: number;
    select: unknown;
  }): Promise<AdminBookingRow[]>;
};

export type AdminBookingsDeps = {
  prisma: {
    booking: BookingDelegate;
  };
};

const ROW_SELECT = {
  id: true,
  date: true,
  anchorTime: true,
  duration: true,
  language: true,
  status: true,
  totalPriceCents: true,
  chargeAmountCents: true,
  creditsAppliedCents: true,
  createdAt: true,
  booker: { select: { name: true, email: true } },
  instructor: { select: { user: { select: { name: true } } } },
  attendees: { select: { id: true } },
} as const;

function buildWhere(filters: AdminBookingsFilters): BookingWhereInput {
  const where: BookingWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.instructorId) where.instructorId = filters.instructorId;
  if (filters.from || filters.to) {
    where.date = {};
    if (filters.from) where.date.gte = filters.from;
    if (filters.to) where.date.lte = filters.to;
  }
  if (filters.q) {
    where.OR = [
      { booker: { name: { contains: filters.q, mode: "insensitive" } } },
      { booker: { email: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  return where;
}

export async function loadAdminBookings(
  deps: AdminBookingsDeps,
  filters: AdminBookingsFilters,
): Promise<AdminBookingsPage> {
  const where = buildWhere(filters);
  const { page, pageSize } = filters;

  const [total, rows] = await Promise.all([
    deps.prisma.booking.count({ where }),
    deps.prisma.booking.findMany({
      where,
      orderBy: [{ date: "desc" }, { anchorTime: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: ROW_SELECT,
    }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return { rows, total, totalPages, page, pageSize };
}
