import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getStudentProfile, type AdminStudentsDeps } from "@/lib/admin/students";
import { formatAdminDate, formatAdminDateTime, formatAdminTime } from "@/lib/admin/format";
import {
  DURATION_LABEL,
  LANGUAGE_LABEL,
  LEVEL_LABEL,
  STATUS_LABEL,
} from "@/lib/labels/booking";
import { prisma } from "@/lib/db";
import { formatChf } from "@/lib/pricing/format";

function studentsDeps(): AdminStudentsDeps {
  return { prisma };
}

export const metadata: Metadata = {
  title: "Student · Admin",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminStudentProfilePage({ params }: Props) {
  const { id } = await params;
  const profile = await getStudentProfile(studentsDeps(), id, { now: new Date() });
  if (!profile) notFound();

  const { contact, stats, notes, bookings } = profile;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/admin/students"
        className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground underline-offset-4 hover:underline"
        data-testid="admin-student-back"
      >
        ← All students
      </Link>

      {/* (1) Contact header */}
      <header
        className="mt-6 space-y-3 border-b border-input pb-8"
        data-testid="admin-student-contact"
      >
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Student
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          {contact.name ?? contact.email}
        </h1>
        <dl className="grid gap-x-8 gap-y-2 pt-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 border-b border-input/60 py-1.5">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="text-right">{contact.email}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-input/60 py-1.5">
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="text-right">{contact.phone ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-input/60 py-1.5">
            <dt className="text-muted-foreground">Language</dt>
            <dd className="text-right">{LANGUAGE_LABEL[contact.locale]}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-input/60 py-1.5">
            <dt className="text-muted-foreground">Roles</dt>
            <dd className="text-right">{contact.roles.join(", ")}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-input/60 py-1.5">
            <dt className="text-muted-foreground">Member since</dt>
            <dd className="text-right">{formatAdminDate(contact.createdAt)}</dd>
          </div>
        </dl>
      </header>

      {/* (2) Lifetime stats */}
      <section className="py-8" data-testid="admin-student-stats">
        <div className="grid gap-px overflow-hidden rounded-lg border border-input bg-input sm:grid-cols-3">
          <div className="bg-background px-5 py-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Lessons taken
            </p>
            <p
              className="mt-2 font-display text-3xl tracking-tight tabular-nums"
              data-testid="admin-student-lessons"
            >
              {stats.lessonsCount}
            </p>
          </div>
          <div className="bg-background px-5 py-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Lifetime spend
            </p>
            <p
              className="mt-2 font-display text-3xl tracking-tight tabular-nums"
              data-testid="admin-student-spend"
            >
              {formatChf(stats.totalSpendCents)}
            </p>
          </div>
          <div className="bg-background px-5 py-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Active credit
            </p>
            <p
              className="mt-2 font-display text-3xl tracking-tight tabular-nums"
              data-testid="admin-student-active-credit"
            >
              {formatChf(stats.activeCreditCents)}
            </p>
          </div>
        </div>
      </section>

      {/* (3) Notes timeline — read-only, cross-instructor, newest first */}
      <section className="border-t border-input py-8" data-testid="admin-student-notes">
        <h2 className="font-display text-2xl tracking-tight">Instructor notes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Internal notes from completed classes. Read-only here — instructors
          edit them from their own agenda.
        </p>

        {notes.length === 0 ? (
          <p
            className="mt-6 text-sm text-muted-foreground"
            data-testid="admin-student-notes-empty"
          >
            No notes yet.
          </p>
        ) : (
          <ol className="mt-6 space-y-5">
            {notes.map((note) => (
              <li
                key={note.bookingId}
                data-testid="admin-student-note"
                className="border-l-2 border-input pl-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-display text-base tracking-tight">
                    {formatAdminDate(note.date)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                    {note.instructorName ?? "Instructor"}
                    {note.setAt ? ` · noted ${formatAdminDateTime(note.setAt)}` : ""}
                  </p>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                  {note.note}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* (4) Bookings history — every status, newest first */}
      <section
        className="border-t border-input py-8"
        data-testid="admin-student-bookings"
      >
        <h2 className="font-display text-2xl tracking-tight">Bookings</h2>

        {bookings.length === 0 ? (
          <p
            className="mt-6 text-sm text-muted-foreground"
            data-testid="admin-student-bookings-empty"
          >
            No bookings yet.
          </p>
        ) : (
          <ul className="mt-6 overflow-hidden rounded-lg border border-input">
            {bookings.map((b) => (
              <li
                key={b.id}
                data-testid="admin-student-booking"
                data-status={b.status}
                className="grid gap-3 border-b border-input px-4 py-4 last:border-b-0 sm:grid-cols-[9rem,1fr,8rem,7rem] sm:items-baseline"
              >
                <div className="font-display text-base tracking-tight tabular-nums">
                  <p>{formatAdminDate(b.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatAdminTime(b.anchorTime)} · {DURATION_LABEL[b.duration]}
                  </p>
                </div>

                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm">{b.instructorName ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.attendees.length === 0
                      ? "No attendees"
                      : b.attendees
                          .map((a) => `${a.name} · ${LEVEL_LABEL[a.level]}`)
                          .join(", ")}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                    {STATUS_LABEL[b.status]}
                  </p>
                </div>

                <div className="text-sm tabular-nums sm:text-right">
                  {formatChf(b.totalPriceCents)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
