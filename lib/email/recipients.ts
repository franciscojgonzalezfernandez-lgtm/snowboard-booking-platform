/**
 * Ops-notification recipient helpers (F-140).
 *
 * The instructor + admin get a single shared operational notification on every
 * booking and cancellation. When the acting instructor *is* the admin (the
 * single-operator MVP: the owner teaches his own lessons), both addresses
 * resolve to the same inbox and we must send exactly one email, not two.
 */

/**
 * F-140: the admin inbox that receives every booking/cancellation ops
 * notification, on top of the acting instructor. Single-operator MVP → the
 * owner. Kept as a constant (per the F-140 decision to reuse the existing ops
 * inbox rather than a DB lookup or new env var); swap to an env var / admin-role
 * query here if the operator model ever grows a second admin.
 */
export const OPS_NOTIFICATION_EMAIL = "franciscojgonzalezfernandez@gmail.com";

/**
 * De-duplicate a recipient list case-insensitively while preserving first-seen
 * order. Blank / whitespace-only entries are dropped. Comparison is done on the
 * lowercased+trimmed form, but the original (trimmed) casing of the first
 * occurrence is what gets returned — Resend receives a clean, unique `to`.
 *
 * Example: `["A@x.io", "a@x.io", "b@x.io"]` → `["A@x.io", "b@x.io"]`.
 */
export function dedupeEmails(emails: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
