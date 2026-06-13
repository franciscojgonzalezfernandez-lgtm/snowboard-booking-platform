import { z } from "zod";

// URL filter schema for the admin student directory (F-087). Parsed in
// `app/admin/students/page.tsx` and consumed by `listStudents`.
//
// Deliberately smaller than `admin-bookings.ts`: the directory only needs a
// free-text search over booker name/email plus pagination. As with the
// bookings list, malformed values are dropped silently (never throw a 500 on a
// hand-mangled admin URL) — the list just renders with the valid filters.

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type AdminStudentsFilters = {
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

function parseIntInRange(
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function parseQ(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 80) return undefined;
  return trimmed;
}

/**
 * Parse `searchParams` into a typed filter set. Invalid values are dropped
 * (no throws).
 */
export function parseAdminStudentsFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AdminStudentsFilters {
  const q = parseQ(readOne(searchParams, "q"));
  const page = parseIntInRange(
    readOne(searchParams, "page"),
    1,
    Number.MAX_SAFE_INTEGER,
    1,
  );
  const pageSize = parseIntInRange(
    readOne(searchParams, "pageSize"),
    1,
    MAX_PAGE_SIZE,
    DEFAULT_PAGE_SIZE,
  );

  return { q, page, pageSize };
}

// Zod schema kept available for a future server-side validator (e.g. a JSON
// endpoint that accepts the same filters as a body), mirroring admin-bookings.
export const adminStudentsFiltersSchema = z.object({
  q: z.string().trim().min(1).max(80).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
