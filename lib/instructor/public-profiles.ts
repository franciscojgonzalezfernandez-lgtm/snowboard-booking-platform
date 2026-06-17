import "server-only";

import { prisma } from "@/lib/db";
import type { Locale } from "@/i18n/routing";
import { slugifyName } from "@/lib/instructor/slugify";

export { slugifyName };

/** Public-facing instructor card/profile shape (F-094). Driven entirely by the
 * `Instructor` row + the joined user name — no slug column in the schema, so the
 * URL slug is derived from the name (see {@link slugifyName}). */
export type PublicInstructor = {
  id: string;
  slug: string;
  name: string;
  photo: string | null;
  bio: string;
  specialties: string[];
  languages: Locale[];
};

const PUBLIC_SELECT = {
  id: true,
  photo: true,
  bio: true,
  specialties: true,
  languages: true,
  user: { select: { name: true } },
} as const;

function toPublic(row: {
  id: string;
  photo: string | null;
  bio: string | null;
  specialties: string[];
  languages: Locale[];
  user: { name: string | null };
}): PublicInstructor {
  const name = row.user.name ?? "Instructor";
  return {
    id: row.id,
    slug: slugifyName(name),
    name,
    photo: row.photo,
    bio: row.bio ?? "",
    specialties: row.specialties,
    languages: row.languages,
  };
}

/** Active instructors for the index grid, owner (oldest) first. */
export async function listActiveInstructors(): Promise<PublicInstructor[]> {
  const rows = await prisma.instructor.findMany({
    where: { active: true },
    select: PUBLIC_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toPublic);
}

/** Resolve a profile by derived slug; `null` ⇒ 404. */
export async function getInstructorBySlug(
  slug: string,
): Promise<PublicInstructor | null> {
  const all = await listActiveInstructors();
  return all.find((i) => i.slug === slug) ?? null;
}
