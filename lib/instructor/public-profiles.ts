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
  /** Row creation time. Used as the sitemap `lastmod` for the profile page
   * (F-099) — the schema has no `updatedAt`, so for a never-edited profile this
   * is the honest last-modified. */
  createdAt: Date;
};

const PUBLIC_SELECT = {
  id: true,
  photo: true,
  bio: true,
  specialties: true,
  languages: true,
  createdAt: true,
  user: { select: { name: true } },
} as const;

function toPublic(row: {
  id: string;
  photo: string | null;
  bio: string | null;
  specialties: string[];
  languages: Locale[];
  createdAt: Date;
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
    createdAt: row.createdAt,
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
