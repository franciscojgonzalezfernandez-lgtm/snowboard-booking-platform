import { describe, expect, test, vi } from "vitest";

import {
  createAnnouncementWith,
  deleteAnnouncementWith,
  setAnnouncementEnabledWith,
  updateAnnouncementWith,
  type AdminAnnouncementsDeps,
} from "./announcements";
import type { AnnouncementInput } from "@/lib/schemas/announcement";

type Options = {
  /** Banner returned by findUnique (null = NOT_FOUND). */
  banner?: { id: string; enabled?: boolean } | null;
  /** Value returned by adBanner.count (enabled banners excluding the target). */
  enabledOthers?: number;
  /** When true, season.findFirst returns a season with a live promo. */
  activePromo?: boolean;
  /** Value for aggregate _max.sortIndex. */
  maxSortIndex?: number | null;
};

function makeDeps(opts: Options = {}) {
  const findUnique = vi.fn(async () =>
    opts.banner === undefined ? { id: "b1", enabled: true } : opts.banner,
  );
  const count = vi.fn(async () => opts.enabledOthers ?? 0);
  const aggregate = vi.fn(async () => ({
    _max: { sortIndex: opts.maxSortIndex ?? null },
  }));
  const create = vi.fn(
    async (_arg: { data: Record<string, unknown> }) => ({ id: "new" }),
  );
  const update = vi.fn(async () => ({ id: "b1" }));
  const del = vi.fn(async () => ({ id: "b1" }));
  const seasonFindFirst = vi.fn(async () =>
    opts.activePromo
      ? { promoPriceCentsByDuration: { ONE_HOUR: 9_500 } }
      : { promoPriceCentsByDuration: null },
  );

  const deps: AdminAnnouncementsDeps = {
    prisma: {
      adBanner: { findUnique, count, aggregate, create, update, delete: del },
      season: { findFirst: seasonFindFirst },
    } as unknown as AdminAnnouncementsDeps["prisma"],
  };
  return { deps, spies: { findUnique, count, create, update, del, seasonFindFirst } };
}

const VALID: AnnouncementInput = {
  body: { en: "Season opening", de: "Saisonstart", es: "Apertura" },
  ctaLabel: { en: "", de: "", es: "" },
  ctaHref: "",
  enabled: true,
};

describe("createAnnouncementWith", () => {
  test("appends after the current max sortIndex, no CTA when blank", async () => {
    const { deps, spies } = makeDeps({ maxSortIndex: 2 });
    const result = await createAnnouncementWith(deps, VALID);

    expect(result).toEqual({ ok: true });
    const arg = spies.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(arg.data.sortIndex).toBe(3);
    expect(arg.data.ctaHref).toBeNull();
  });

  test("rejects a CTA href with no labels (partial CTA)", async () => {
    const { deps, spies } = makeDeps();
    const result = await createAnnouncementWith(deps, {
      ...VALID,
      ctaHref: "/reservar",
    });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(spies.create).not.toHaveBeenCalled();
  });

  test("rejects a disallowed CTA href scheme", async () => {
    const { deps } = makeDeps();
    const result = await createAnnouncementWith(deps, {
      ...VALID,
      ctaHref: "javascript:alert(1)",
      ctaLabel: { en: "Go", de: "Los", es: "Ir" },
    });
    expect(result).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  test("accepts a complete CTA and persists the normalized shape", async () => {
    const { deps, spies } = makeDeps({ maxSortIndex: null });
    const result = await createAnnouncementWith(deps, {
      ...VALID,
      ctaHref: "/reservar",
      ctaLabel: { en: "Book", de: "Buchen", es: "Reservar" },
    });
    expect(result).toEqual({ ok: true });
    const arg = spies.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(arg.data.sortIndex).toBe(0);
    expect(arg.data.ctaHref).toBe("/reservar");
    expect(arg.data.ctaLabel).toEqual({ en: "Book", de: "Buchen", es: "Reservar" });
  });
});

describe("setAnnouncementEnabledWith", () => {
  test("blocks disabling the last enabled banner while a promo is live", async () => {
    const { deps, spies } = makeDeps({ enabledOthers: 0, activePromo: true });
    const result = await setAnnouncementEnabledWith(deps, "b1", false);

    expect(result).toEqual({ ok: false, error: "BANNER_REQUIRED_BY_PROMO" });
    expect(spies.update).not.toHaveBeenCalled();
  });

  test("allows disabling when another enabled banner remains", async () => {
    const { deps, spies } = makeDeps({ enabledOthers: 1, activePromo: true });
    const result = await setAnnouncementEnabledWith(deps, "b1", false);

    expect(result).toEqual({ ok: true });
    expect(spies.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { enabled: false },
    });
  });

  test("allows disabling the last banner when no promo is live", async () => {
    const { deps } = makeDeps({ enabledOthers: 0, activePromo: false });
    const result = await setAnnouncementEnabledWith(deps, "b1", false);
    expect(result).toEqual({ ok: true });
  });

  test("enabling never triggers the banner guard", async () => {
    const { deps, spies } = makeDeps({ enabledOthers: 0, activePromo: true });
    const result = await setAnnouncementEnabledWith(deps, "b1", true);
    expect(result).toEqual({ ok: true });
    expect(spies.count).not.toHaveBeenCalled();
  });

  test("returns NOT_FOUND for an unknown banner", async () => {
    const { deps } = makeDeps({ banner: null });
    const result = await setAnnouncementEnabledWith(deps, "missing", false);
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});

describe("deleteAnnouncementWith", () => {
  test("blocks deleting the last enabled banner while a promo is live", async () => {
    const { deps, spies } = makeDeps({ enabledOthers: 0, activePromo: true });
    const result = await deleteAnnouncementWith(deps, "b1");

    expect(result).toEqual({ ok: false, error: "BANNER_REQUIRED_BY_PROMO" });
    expect(spies.del).not.toHaveBeenCalled();
  });

  test("deletes when another enabled banner remains", async () => {
    const { deps, spies } = makeDeps({ enabledOthers: 2, activePromo: true });
    const result = await deleteAnnouncementWith(deps, "b1");
    expect(result).toEqual({ ok: true });
    expect(spies.del).toHaveBeenCalledWith({ where: { id: "b1" } });
  });
});

describe("updateAnnouncementWith", () => {
  test("blocks an edit that disables the last banner while a promo is live", async () => {
    const { deps, spies } = makeDeps({ enabledOthers: 0, activePromo: true });
    const result = await updateAnnouncementWith(deps, "b1", {
      ...VALID,
      enabled: false,
    });
    expect(result).toEqual({ ok: false, error: "BANNER_REQUIRED_BY_PROMO" });
    expect(spies.update).not.toHaveBeenCalled();
  });
});
