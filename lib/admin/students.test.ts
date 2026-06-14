import { describe, expect, test, vi } from "vitest";
import { BookingStatus, Duration, Level, Locale, Role } from "@prisma/client";

import { parseAdminStudentsFilters, DEFAULT_PAGE_SIZE } from "@/lib/schemas/admin-students";

import {
  getStudentProfile,
  listStudents,
  type AdminStudentsDeps,
} from "./students";

const NOW = new Date("2026-06-13T12:00:00.000Z");

// ──────────────────────────────────────────────────────────────────────────
// listStudents

type UserFindManyArgs = {
  where: Record<string, unknown>;
  orderBy: Array<Record<string, "asc" | "desc">>;
  skip: number;
  take: number;
};

function makeListDeps(opts: {
  users: Array<{
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    locale: Locale;
  }>;
  total: number;
  bookingAgg?: Array<{ bookerId: string; _count: { _all: number }; _max: { date: Date | null } }>;
  creditAgg?: Array<{ userId: string; _sum: { amountCents: number | null } }>;
}) {
  let lastFindManyArgs: UserFindManyArgs | undefined;
  const count = vi.fn(async () => opts.total);
  const findMany = vi.fn(async (args: UserFindManyArgs) => {
    lastFindManyArgs = args;
    return opts.users;
  });
  const bookingGroupBy = vi.fn(async () => opts.bookingAgg ?? []);
  const creditGroupBy = vi.fn(async () => opts.creditAgg ?? []);

  const deps: AdminStudentsDeps = {
    prisma: {
      user: { count, findMany },
      booking: { groupBy: bookingGroupBy },
      accountCredit: { groupBy: creditGroupBy },
    } as unknown as AdminStudentsDeps["prisma"],
  };
  return {
    deps,
    spies: { count, findMany, bookingGroupBy, creditGroupBy },
    getFindManyArgs: () => {
      if (!lastFindManyArgs) throw new Error("findMany never invoked");
      return lastFindManyArgs;
    },
  };
}

describe("listStudents", () => {
  test("no search → default pagination, restricts to bookers, merges aggregates", async () => {
    const { deps, spies, getFindManyArgs } = makeListDeps({
      users: [
        { id: "u1", name: "Anna", email: "anna@example.com", phone: "+41 1", locale: Locale.de },
        { id: "u2", name: "Bert", email: "bert@example.com", phone: null, locale: Locale.en },
      ],
      total: 2,
      bookingAgg: [
        { bookerId: "u1", _count: { _all: 3 }, _max: { date: new Date("2026-05-01T00:00:00.000Z") } },
        { bookerId: "u2", _count: { _all: 1 }, _max: { date: new Date("2026-04-10T00:00:00.000Z") } },
      ],
      creditAgg: [{ userId: "u1", _sum: { amountCents: 11000 } }],
    });

    const out = await listStudents(deps, parseAdminStudentsFilters({}), { now: NOW });

    expect(out).toMatchObject({ total: 2, totalPages: 1, page: 1, pageSize: DEFAULT_PAGE_SIZE });
    // Only actual bookers.
    expect(getFindManyArgs().where).toEqual({ bookings: { some: {} } });
    expect(getFindManyArgs().orderBy).toEqual([{ name: "asc" }, { email: "asc" }]);

    expect(out.rows[0]).toEqual({
      id: "u1",
      name: "Anna",
      email: "anna@example.com",
      phone: "+41 1",
      locale: Locale.de,
      bookingsCount: 3,
      lastBookingDate: new Date("2026-05-01T00:00:00.000Z"),
      activeCreditCents: 11000,
    });
    // u2 has no credit row → 0.
    expect(out.rows[1]).toMatchObject({ id: "u2", bookingsCount: 1, activeCreditCents: 0 });

    // No N+1: one grouped query each, not one per user.
    expect(spies.bookingGroupBy).toHaveBeenCalledOnce();
    expect(spies.creditGroupBy).toHaveBeenCalledOnce();
  });

  test("search builds case-insensitive OR over name/email", async () => {
    const { deps, getFindManyArgs } = makeListDeps({ users: [], total: 0 });
    await listStudents(deps, parseAdminStudentsFilters({ q: " Anna " }), { now: NOW });
    expect(getFindManyArgs().where).toEqual({
      bookings: { some: {} },
      OR: [
        { name: { contains: "Anna", mode: "insensitive" } },
        { email: { contains: "Anna", mode: "insensitive" } },
      ],
    });
  });

  test("active credit aggregate is filtered ACTIVE and unexpired", async () => {
    const { deps, spies } = makeListDeps({
      users: [{ id: "u1", name: "A", email: "a@x.com", phone: null, locale: Locale.en }],
      total: 1,
    });
    await listStudents(deps, parseAdminStudentsFilters({}), { now: NOW });
    expect(spies.creditGroupBy).toHaveBeenCalledWith({
      by: ["userId"],
      where: { userId: { in: ["u1"] }, status: "ACTIVE", expiresAt: { gt: NOW } },
      _sum: { amountCents: true },
    });
  });

  test("empty page skips the aggregate queries entirely", async () => {
    const { deps, spies } = makeListDeps({ users: [], total: 0 });
    const out = await listStudents(deps, parseAdminStudentsFilters({}), { now: NOW });
    expect(out.rows).toEqual([]);
    expect(spies.bookingGroupBy).not.toHaveBeenCalled();
    expect(spies.creditGroupBy).not.toHaveBeenCalled();
  });

  test("paginates with skip/take", async () => {
    const { deps, getFindManyArgs } = makeListDeps({ users: [], total: 30 });
    const out = await listStudents(
      deps,
      parseAdminStudentsFilters({ page: "2", pageSize: "10" }),
      { now: NOW },
    );
    expect(getFindManyArgs().skip).toBe(10);
    expect(getFindManyArgs().take).toBe(10);
    expect(out.totalPages).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// getStudentProfile

type ProfileBooking = {
  id: string;
  date: Date;
  anchorTime: string;
  duration: Duration;
  language: Locale;
  status: BookingStatus;
  totalPriceCents: number;
  instructorNote: string | null;
  instructorNoteSetAt: Date | null;
  instructor: { user: { name: string | null } };
  attendees: { id: string; name: string; level: Level }[];
};

function makeProfileDeps(opts: {
  user:
    | {
        id: string;
        name: string | null;
        email: string;
        phone: string | null;
        locale: Locale;
        roles: Role[];
        createdAt: Date;
        bookings: ProfileBooking[];
      }
    | null;
  activeCreditCents?: number;
}) {
  const findUnique = vi.fn(async () => opts.user);
  const aggregate = vi.fn(async () => ({
    _sum: { amountCents: opts.activeCreditCents ?? 0 },
  }));
  const deps: AdminStudentsDeps = {
    prisma: {
      user: { findUnique },
      accountCredit: { aggregate },
    } as unknown as AdminStudentsDeps["prisma"],
  };
  return { deps, spies: { findUnique, aggregate } };
}

function booking(overrides: Partial<ProfileBooking>): ProfileBooking {
  return {
    id: overrides.id ?? "bk",
    date: overrides.date ?? new Date("2026-05-01T00:00:00.000Z"),
    anchorTime: overrides.anchorTime ?? "10:00",
    duration: overrides.duration ?? Duration.ONE_HOUR,
    language: overrides.language ?? Locale.en,
    status: overrides.status ?? BookingStatus.CONFIRMED,
    totalPriceCents: overrides.totalPriceCents ?? 11000,
    instructorNote: overrides.instructorNote ?? null,
    instructorNoteSetAt: overrides.instructorNoteSetAt ?? null,
    instructor: overrides.instructor ?? { user: { name: "Javi" } },
    attendees: overrides.attendees ?? [{ id: "a1", name: "Sam", level: Level.BEGINNER }],
  };
}

describe("getStudentProfile", () => {
  test("returns null when the user does not exist", async () => {
    const { deps, spies } = makeProfileDeps({ user: null });
    const out = await getStudentProfile(deps, "missing", { now: NOW });
    expect(out).toBeNull();
    // Short-circuits before touching credit.
    expect(spies.aggregate).not.toHaveBeenCalled();
  });

  test("aggregates bookings of every status; stats + notes follow the documented rules", async () => {
    const completedWithNote = booking({
      id: "c1",
      status: BookingStatus.COMPLETED,
      date: new Date("2026-05-10T00:00:00.000Z"),
      totalPriceCents: 20000,
      instructorNote: "Strong toeside.",
      instructorNoteSetAt: new Date("2026-05-10T18:00:00.000Z"),
      instructor: { user: { name: "Lara" } },
    });
    const completedNoNote = booking({
      id: "c2",
      status: BookingStatus.COMPLETED,
      date: new Date("2026-05-05T00:00:00.000Z"),
      totalPriceCents: 11000,
    });
    const confirmed = booking({ id: "cf", status: BookingStatus.CONFIRMED, totalPriceCents: 11000 });
    const cancelled = booking({
      id: "cx",
      status: BookingStatus.CANCELLED_BY_USER,
      totalPriceCents: 50000,
    });
    const pending = booking({
      id: "pp",
      status: BookingStatus.PENDING_PAYMENT,
      totalPriceCents: 38500,
    });

    const { deps } = makeProfileDeps({
      user: {
        id: "u1",
        name: "Anna",
        email: "anna@example.com",
        phone: "+41",
        locale: Locale.de,
        roles: [Role.student],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        // Newest-first as the query orders them.
        bookings: [completedWithNote, completedNoNote, confirmed, cancelled, pending],
      },
      activeCreditCents: 5000,
    });

    const out = await getStudentProfile(deps, "u1", { now: NOW });
    expect(out).not.toBeNull();
    const profile = out!;

    // All statuses surface in the bookings history.
    expect(profile.bookings).toHaveLength(5);
    expect(profile.bookings.map((b) => b.id)).toEqual(["c1", "c2", "cf", "cx", "pp"]);
    // Internal note text is not leaked onto booking rows.
    expect(profile.bookings[0]).not.toHaveProperty("instructorNote");

    // Notes: only COMPLETED with a non-null note, newest first, with author.
    expect(profile.notes).toEqual([
      {
        bookingId: "c1",
        date: new Date("2026-05-10T00:00:00.000Z"),
        setAt: new Date("2026-05-10T18:00:00.000Z"),
        note: "Strong toeside.",
        instructorName: "Lara",
      },
    ]);

    // lessons = COMPLETED count (2).
    expect(profile.stats.lessonsCount).toBe(2);
    // spend = CONFIRMED + COMPLETED only (20000 + 11000 + 11000), excludes
    // cancelled + pending.
    expect(profile.stats.totalSpendCents).toBe(42000);
    expect(profile.stats.activeCreditCents).toBe(5000);

    expect(profile.contact).toEqual({
      id: "u1",
      name: "Anna",
      email: "anna@example.com",
      phone: "+41",
      locale: Locale.de,
      roles: [Role.student],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  test("credit balance query is filtered ACTIVE and unexpired", async () => {
    const { deps, spies } = makeProfileDeps({
      user: {
        id: "u1",
        name: null,
        email: "x@x.com",
        phone: null,
        locale: Locale.en,
        roles: [Role.student],
        createdAt: NOW,
        bookings: [],
      },
    });
    await getStudentProfile(deps, "u1", { now: NOW });
    expect(spies.aggregate).toHaveBeenCalledWith({
      where: { userId: "u1", status: "ACTIVE", expiresAt: { gt: NOW } },
      _sum: { amountCents: true },
    });
  });
});
