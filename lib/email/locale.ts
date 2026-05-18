export type EmailLocale = "en" | "de" | "es";

const SUPPORTED = ["en", "de", "es"] as const;

function normalize(tag: string): EmailLocale | null {
  const base = tag.trim().toLowerCase().split(/[;-]/)[0] ?? "";
  return (SUPPORTED as readonly string[]).includes(base)
    ? (base as EmailLocale)
    : null;
}

export function resolveEmailLocale(input?: string | null): EmailLocale {
  if (!input) return "en";
  for (const part of input.split(",")) {
    const match = normalize(part);
    if (match) return match;
  }
  return "en";
}

type HeadersLike = {
  get(name: string): string | null;
};

export function getEmailLocaleFromRequest(
  request?: { headers: HeadersLike } | null,
): EmailLocale {
  if (!request) return "en";

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
    const value = match?.[1];
    if (value) {
      const normalized = normalize(decodeURIComponent(value));
      if (normalized) return normalized;
    }
  }

  return resolveEmailLocale(request.headers.get("accept-language"));
}
