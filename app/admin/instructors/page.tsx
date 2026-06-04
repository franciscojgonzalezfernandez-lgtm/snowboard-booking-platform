import type { Metadata } from "next";

import { prisma } from "@/lib/db";

import { CreateInstructorForm } from "./_components/create-instructor-form";
import { InstructorRow } from "./_components/instructor-row";

export const metadata: Metadata = {
  title: "Instructors · Admin",
};

export default async function AdminInstructorsPage() {
  const instructors = await prisma.instructor.findMany({
    select: {
      id: true,
      bio: true,
      languages: true,
      specialties: true,
      active: true,
      user: { select: { name: true, email: true } },
    },
    // Active first, then by creation order within each group.
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Instructors
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          Manage instructors
        </h1>
        <p className="text-sm text-muted-foreground">
          Add a coach, edit their profile, or deactivate them. Deactivating never
          deletes data — it removes them from booking availability.
        </p>
      </header>

      <section className="space-y-5 border-b border-input py-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          New instructor
        </h2>
        <CreateInstructorForm />
      </section>

      <section className="space-y-5 py-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          All instructors ({instructors.length})
        </h2>
        <ul className="space-y-4" data-testid="admin-instructor-list">
          {instructors.map((i) => (
            <InstructorRow
              key={i.id}
              instructor={{
                id: i.id,
                name: i.user.name ?? i.user.email,
                email: i.user.email,
                bio: i.bio ?? "",
                languages: i.languages,
                specialties: i.specialties,
                active: i.active,
              }}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
