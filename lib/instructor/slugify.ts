/** Diacritic-folding kebab slug. "Lara Müller" → "lara-muller".
 * ponytail: instructor URLs are derived from the display name, not a DB column.
 * Two instructors that slugify to the same value collide silently (first wins
 * in the lookup map) — add an `Instructor.slug` column if/when self-service
 * onboarding allows duplicate display names. */
export function slugifyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
