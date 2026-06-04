import { BookingStatus } from "@prisma/client";
import { z } from "zod";

// URL filter schema for the admin bookings list (F-077). Parsed in
// `app/admin/bookings/page.tsx` and consumed by `loadAdminBookings`.
//
// Malformed values are dropped silently (returned as `undefined` / defaults)
// instead of erroring — admin URL malformations should never throw a 500. The
// list still renders with the remaining valid filters applied.

const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/u;

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type AdminBookingsFilters = {
  status?: BookingStatus;
  instructorId?: string;
  from?: Date;
  to?: Date;
  q?: string;
  page: number;
  pageSize: number;
};

function readOne(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = searchParams[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseIntInRange(raw: string | undefined, min: number, max: number, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function parseIsoDate(raw: string | undefined): Date | undefined {
  if (!raw || !ISO_DATE_RE.test(raw)) return undefined;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseStatus(raw: string | undefined): BookingStatus | undefined {
  if (!raw) return undefined;
  return (Object.values(BookingStatus) as string[]).includes(raw)
    ? (raw as BookingStatus)
    : undefined;
}

function parseQ(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 80) return undefined;
  return trimmed;
}

function parseInstructorId(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  // Loose cuid-ish guard: non-empty, no spaces. We don't validate format
  // strictly because Prisma will simply return zero rows if it's bogus.
  if (trimmed.length < 1 || trimmed.length > 64) return undefined;
  if (/\s/.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * Parse `searchParams` into a typed filter set. Invalid values are dropped
 * (no throws). `from`/`to` are swapped if `from > to` so users can't get an
 * empty list by typo.
 */
export function parseAdminBookingsFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AdminBookingsFilters {
  const status = parseStatus(readOne(searchParams, "status"));
  const instructorId = parseInstructorId(readOne(searchParams, "instructorId"));
  let from = parseIsoDate(readOne(searchParams, "from"));
  let to = parseIsoDate(readOne(searchParams, "to"));
  if (from && to && from.getTime() > to.getTime()) {
    [from, to] = [to, from];
  }
  const q = parseQ(readOne(searchParams, "q"));
  const page = parseIntInRange(readOne(searchParams, "page"), 1, Number.MAX_SAFE_INTEGER, 1);
  const pageSize = parseIntInRange(
    readOne(searchParams, "pageSize"),
    1,
    MAX_PAGE_SIZE,
    DEFAULT_PAGE_SIZE,
  );

  return { status, instructorId, from, to, q, page, pageSize };
}

// Zod schema kept available for future server-side validators (e.g. if a
// future admin endpoint accepts the same filters as a JSON body).
export const adminBookingsFiltersSchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
  instructorId: z.string().min(1).max(64).optional(),
  from: z.date().optional(),
  to: z.date().optional(),
  q: z.string().trim().min(1).max(80).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
