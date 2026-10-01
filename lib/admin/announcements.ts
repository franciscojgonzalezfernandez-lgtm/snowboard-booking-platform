import { Prisma } from "@prisma/client";

import { activeSeasonHasPromo } from "@/lib/admin/pricing";
import type { Db } from "@/lib/db";
import {
  announcementInputSchema,
  type AnnouncementInput,
} from "@/lib/schemas/announcement";

// Pure, dependency-injected cores for the ad-banner admin section (F-142). Like
// the other admin cores they live in `lib/` so Vitest can drive them with a fake
// Prisma; the `"use server"` wrappers in `app/(ops)/admin/actions.ts` gate on
// `requireAdmin()` + revalidate around these.
//
// Cross-entity invariant with pricing (F-141/F-142): while the active season has
// any live promotion, at least one enabled banner MUST exist to advertise it.
// The forward half (adding a promo needs a banner) lives in lib/admin/pricing.ts
// (`PROMO_REQUIRES_BANNER`); the reverse half (removing/disabling the last banner
// while a promo is live) lives here (`BANNER_REQUIRED_BY_PROMO`).

export type AdminAnnouncementsDeps = {
  prisma: Db;
};

export type AdminAnnouncementError =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "BANNER_REQUIRED_BY_PROMO";

export type AnnouncementResult =
  | { ok: true }
  | { ok: false; error: AdminAnnouncementError };

export type AdminAnnouncementRow = {
  id: string;
  enabled: boolean;
  sortIndex: number;
  body: { en: string; de: string; es: string };
  ctaLabel: { en: string; de: string; es: string } | null;
  ctaHref: string | null;
};

function readLocalized(value: unknown): { en: string; de: string; es: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  return {
    en: typeof rec.en === "string" ? rec.en : "",
    de: typeof rec.de === "string" ? rec.de : "",
    es: typeof rec.es === "string" ? rec.es : "",
  };
}

/** All banners in display order (enabled first is NOT implied — pure sortIndex). */
export async function listAnnouncementsWith(
  deps: AdminAnnouncementsDeps,
): Promise<AdminAnnouncementRow[]> {
  const rows = await deps.prisma.adBanner.findMany({
    orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      enabled: true,
      sortIndex: true,
      body: true,
      ctaLabel: true,
      ctaHref: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    enabled: row.enabled,
    sortIndex: row.sortIndex,
    body: readLocalized(row.body) ?? { en: "", de: "", es: "" },
    ctaLabel: readLocalized(row.ctaLabel),
    ctaHref: row.ctaHref,
  }));
}

/** Normalize the validated CTA group to the persisted shape (or nulls). */
function normalizeCta(input: {
  ctaLabel: { en: string; de: string; es: string };
  ctaHref: string;
}): { ctaLabel: Prisma.InputJsonValue | typeof Prisma.DbNull; ctaHref: string | null } {
  const href = input.ctaHref.trim();
  if (href.length === 0) return { ctaLabel: Prisma.DbNull, ctaHref: null };
  return {
    ctaLabel: {
      en: input.ctaLabel.en.trim(),
      de: input.ctaLabel.de.trim(),
      es: input.ctaLabel.es.trim(),
    },
    ctaHref: href,
  };
}

/**
 * Would the store be left with zero enabled banners after an operation, while a
 * promo is live? `enabledAfter` is the caller's computed post-op enabled count.
 */
async function violatesBannerRequirement(
  deps: AdminAnnouncementsDeps,
  enabledAfter: number,
): Promise<boolean> {
  if (enabledAfter > 0) return false;
  return activeSeasonHasPromo(deps);
}

export async function createAnnouncementWith(
  deps: AdminAnnouncementsDeps,
  input: AnnouncementInput,
): Promise<AnnouncementResult> {
  const parsed = announcementInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  // Append to the end of the order.
  const max = await deps.prisma.adBanner.aggregate({
    _max: { sortIndex: true },
  });
  const sortIndex = (max._max.sortIndex ?? -1) + 1;
  const cta = normalizeCta(parsed.data);

  await deps.prisma.adBanner.create({
    data: {
      enabled: parsed.data.enabled,
      sortIndex,
      body: {
        en: parsed.data.body.en,
        de: parsed.data.body.de,
        es: parsed.data.body.es,
      },
      ctaLabel: cta.ctaLabel,
      ctaHref: cta.ctaHref,
    },
  });
  return { ok: true };
}

export async function updateAnnouncementWith(
  deps: AdminAnnouncementsDeps,
  id: string,
  input: AnnouncementInput,
): Promise<AnnouncementResult> {
  const parsed = announcementInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const existing = await deps.prisma.adBanner.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "NOT_FOUND" };

  // If this edit turns the banner off, make sure a live promo still has one.
  if (!parsed.data.enabled) {
    const enabledOthers = await deps.prisma.adBanner.count({
      where: { enabled: true, id: { not: id } },
    });
    if (await violatesBannerRequirement(deps, enabledOthers)) {
      return { ok: false, error: "BANNER_REQUIRED_BY_PROMO" };
    }
  }

  const cta = normalizeCta(parsed.data);
  await deps.prisma.adBanner.update({
    where: { id },
    data: {
      enabled: parsed.data.enabled,
      body: {
        en: parsed.data.body.en,
        de: parsed.data.body.de,
        es: parsed.data.body.es,
      },
      ctaLabel: cta.ctaLabel,
      ctaHref: cta.ctaHref,
    },
  });
  return { ok: true };
}

export async function setAnnouncementEnabledWith(
  deps: AdminAnnouncementsDeps,
  id: string,
  enabled: boolean,
): Promise<AnnouncementResult> {
  const existing = await deps.prisma.adBanner.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "NOT_FOUND" };

  if (!enabled) {
    const enabledOthers = await deps.prisma.adBanner.count({
      where: { enabled: true, id: { not: id } },
    });
    if (await violatesBannerRequirement(deps, enabledOthers)) {
      return { ok: false, error: "BANNER_REQUIRED_BY_PROMO" };
    }
  }

  await deps.prisma.adBanner.update({ where: { id }, data: { enabled } });
  return { ok: true };
}

export async function deleteAnnouncementWith(
  deps: AdminAnnouncementsDeps,
  id: string,
): Promise<AnnouncementResult> {
  const existing = await deps.prisma.adBanner.findUnique({
    where: { id },
    select: { id: true, enabled: true },
  });
  if (!existing) return { ok: false, error: "NOT_FOUND" };

  // Deleting an enabled banner could leave a live promo with none.
  const enabledOthers = await deps.prisma.adBanner.count({
    where: { enabled: true, id: { not: id } },
  });
  if (await violatesBannerRequirement(deps, enabledOthers)) {
    return { ok: false, error: "BANNER_REQUIRED_BY_PROMO" };
  }

  await deps.prisma.adBanner.delete({ where: { id } });
  return { ok: true };
}

/**
 * Persist a new display order. `orderedIds` is the full list of banner ids in the
 * desired order; each gets its array index as `sortIndex` in one transaction.
 */
export async function reorderAnnouncementsWith(
  deps: AdminAnnouncementsDeps,
  orderedIds: string[],
): Promise<AnnouncementResult> {
  await deps.prisma.$transaction(
    orderedIds.map((id, index) =>
      deps.prisma.adBanner.update({
        where: { id },
        data: { sortIndex: index },
      }),
    ),
  );
  return { ok: true };
}
