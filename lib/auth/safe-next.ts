import { routing } from "@/i18n/routing";

/**
 * Validates a `?next=` redirect target. Returns the input if it is a safe
 * locale-prefixed in-app path; otherwise falls back to `/{locale}`.
 *
 * Guards against:
 * - external redirects (scheme, protocol-relative `//evil.com`, encoded `//`)
 * - bare paths outside the known locale prefixes
 */
export function sanitizeNext(
  raw: string | null | undefined,
  locale: string,
): string {
  const fallback = `/${locale}`;
  if (!raw) return fallback;
  if (typeof raw !== "string") return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  try {
    if (decodeURIComponent(raw).startsWith("//")) return fallback;
  } catch {
    return fallback;
  }

  const prefixes = routing.locales.map((l) => `/${l}/`);
  const exactRoots = routing.locales.map((l) => `/${l}`);
  const ok =
    exactRoots.includes(raw) || prefixes.some((p) => raw.startsWith(p));
  if (!ok) return fallback;
  return raw;
}
