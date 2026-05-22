import { Locale } from "@prisma/client";

const SUPPORTED = ["en", "de", "es"] as const;

function normalize(tag: string): Locale | null {
  const base = tag.trim().toLowerCase().split(/[;-]/)[0] ?? "";
  return (SUPPORTED as readonly string[]).includes(base)
    ? (base as Locale)
    : null;
}

export function resolveEmailLocale(input?: string | null): Locale {
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
): Locale {
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
