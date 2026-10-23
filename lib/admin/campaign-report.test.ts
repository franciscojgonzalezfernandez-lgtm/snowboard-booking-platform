import { describe, expect, test, vi } from "vitest";
import { BookingSource, BookingStatus } from "@prisma/client";

import { loadCampaignReport, type CampaignReportDeps } from "./campaign-report";

type FindManyArgs = { where: Record<string, unknown>; select: Record<string, unknown> };

type Row = {
  attributionChannel: BookingSource;
  attributionCampaign: string | null;
  utmSource: string | null;
  chargeAmountCents: number | null;
  totalPriceCents: number;
};

function row(overrides: Partial<Row> = {}): Row {
  return {
    attributionChannel: overrides.attributionChannel ?? BookingSource.DIRECT,
    attributionCampaign: overrides.attributionCampaign ?? null,
    utmSource: overrides.utmSource ?? null,
    chargeAmountCents:
      overrides.chargeAmountCents === undefined ? 11000 : overrides.chargeAmountCents,
    totalPriceCents: overrides.totalPriceCents ?? 11000,
  };
}

function makeDeps(rows: Row[]) {
  let lastArgs: FindManyArgs | undefined;
  const findMany = vi.fn(async (args: FindManyArgs) => {
    lastArgs = args;
    return rows;
  });
  const deps: CampaignReportDeps = {
    prisma: { booking: { findMany } } as unknown as CampaignReportDeps["prisma"],
  };
  return { deps, getArgs: () => lastArgs, findMany };
}

describe("loadCampaignReport", () => {
  test("only CONFIRMED + COMPLETED are queried", async () => {
    const { deps, getArgs } = makeDeps([]);
    await loadCampaignReport(deps);
    expect(getArgs()?.where).toEqual({
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
    });
  });

  test("empty → zeroed report", async () => {
    const { deps } = makeDeps([]);
    const out = await loadCampaignReport(deps);
    expect(out).toEqual({ rows: [], totalBookings: 0, totalRevenueCents: 0 });
  });

  test("groups by (channel, campaign) and sums bookings + revenue", async () => {
    const { deps } = makeDeps([
      row({ attributionChannel: BookingSource.FLYER, attributionCampaign: "flyer-talstation", chargeAmountCents: 11000 }),
      row({ attributionChannel: BookingSource.FLYER, attributionCampaign: "flyer-talstation", chargeAmountCents: 20000 }),
      row({ attributionChannel: BookingSource.DIRECT, attributionCampaign: null, chargeAmountCents: 11000 }),
    ]);
    const out = await loadCampaignReport(deps);

    expect(out.totalBookings).toBe(3);
    expect(out.totalRevenueCents).toBe(42000);
    const flyer = out.rows.find((r) => r.campaign === "flyer-talstation");
    expect(flyer).toMatchObject({
      channel: BookingSource.FLYER,
      label: "Flyer · Talstation",
      bookings: 2,
      revenueCents: 31000,
    });
    const direct = out.rows.find((r) => r.channel === BookingSource.DIRECT);
    expect(direct).toMatchObject({ label: "Direct", bookings: 1, revenueCents: 11000 });
  });

  test("revenue uses chargeAmountCents, falling back to totalPriceCents when null", async () => {
    const { deps } = makeDeps([
      // zero-charge (fully credit) booking: charged 0, still a booking, 0 revenue
      row({ chargeAmountCents: 0, totalPriceCents: 11000 }),
      // legacy row with null charge → falls back to the ledger price
      row({ chargeAmountCents: null, totalPriceCents: 20000 }),
    ]);
    const out = await loadCampaignReport(deps);
    expect(out.totalBookings).toBe(2);
    expect(out.totalRevenueCents).toBe(20000);
  });

  test("rows sorted by revenue desc", async () => {
    const { deps } = makeDeps([
      row({ attributionChannel: BookingSource.DIRECT, chargeAmountCents: 5000 }),
      row({ attributionChannel: BookingSource.FLYER, attributionCampaign: "flyer-talstation", chargeAmountCents: 50000 }),
    ]);
    const out = await loadCampaignReport(deps);
    expect(out.rows[0]!.channel).toBe(BookingSource.FLYER);
    expect(out.rows[1]!.channel).toBe(BookingSource.DIRECT);
  });

  test("unknown campaign code labels as the raw code", async () => {
    const { deps } = makeDeps([
      row({ attributionChannel: BookingSource.OTHER, attributionCampaign: "mystery" }),
    ]);
    const out = await loadCampaignReport(deps);
    expect(out.rows[0]!.label).toBe("mystery");
  });

  test("SOCIAL splits into one row per platform, labelled by source", async () => {
    const { deps } = makeDeps([
      row({ attributionChannel: BookingSource.SOCIAL, utmSource: "instagram", chargeAmountCents: 11000 }),
      row({ attributionChannel: BookingSource.SOCIAL, utmSource: "instagram", chargeAmountCents: 11000 }),
      row({ attributionChannel: BookingSource.SOCIAL, utmSource: "tiktok", chargeAmountCents: 20000 }),
    ]);
    const out = await loadCampaignReport(deps);

    const ig = out.rows.find((r) => r.source === "instagram");
    const tiktok = out.rows.find((r) => r.source === "tiktok");
    expect(ig).toMatchObject({ label: "Social · Instagram", bookings: 2, revenueCents: 22000 });
    expect(tiktok).toMatchObject({ label: "Social · TikTok", bookings: 1, revenueCents: 20000 });
  });

  test("source aliases fold into one platform row (ig = instagram, fb = facebook)", async () => {
    const { deps } = makeDeps([
      row({ attributionChannel: BookingSource.SOCIAL, utmSource: "ig" }),
      row({ attributionChannel: BookingSource.SOCIAL, utmSource: "Instagram" }),
      row({ attributionChannel: BookingSource.SOCIAL, utmSource: "fb" }),
    ]);
    const out = await loadCampaignReport(deps);

    const ig = out.rows.find((r) => r.source === "instagram");
    const fb = out.rows.find((r) => r.source === "facebook");
    expect(ig).toMatchObject({ bookings: 2, label: "Social · Instagram" });
    expect(fb).toMatchObject({ bookings: 1, label: "Social · Facebook" });
    expect(out.rows).toHaveLength(2);
  });

  test("a tagged campaign label still wins over the source refinement", async () => {
    const { deps } = makeDeps([
      row({
        attributionChannel: BookingSource.SOCIAL,
        attributionCampaign: "flyer-talstation",
        utmSource: "instagram",
      }),
    ]);
    const out = await loadCampaignReport(deps);
    expect(out.rows[0]!.label).toBe("Flyer · Talstation");
  });
});
