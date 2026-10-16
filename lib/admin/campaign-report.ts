import "server-only";

import { BookingSource, BookingStatus } from "@prisma/client";

import { campaignLabel } from "@/lib/attribution/campaigns";
import { SOURCE_LABEL } from "@/lib/labels/booking";
import type { Db } from "@/lib/db";

// F-156: the campaign rollup for /admin/campaigns — bookings count + CHF revenue
// per (channel, campaign). Only CONFIRMED + COMPLETED bookings count as "a
// booking that happened" (PENDING, cancelled, failed and refunded are excluded).
//
// Aggregated in JS rather than via prisma.groupBy so revenue can coalesce per
// row (what was actually PAID = chargeAmountCents, falling back to
// totalPriceCents when null — the F-084 money rule), which a groupBy _sum cannot
// express. The dataset is one instructor / one season, so the row scan is cheap.

const COUNTED_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];

const REPORT_SELECT = {
  attributionChannel: true,
  attributionCampaign: true,
  chargeAmountCents: true,
  totalPriceCents: true,
} as const;

export type CampaignReportRow = {
  channel: BookingSource;
  campaign: string | null;
  /** Display name: campaign label if tagged, else the channel's own label. */
  label: string;
  bookings: number;
  revenueCents: number;
};

export type CampaignReport = {
  rows: CampaignReportRow[];
  totalBookings: number;
  totalRevenueCents: number;
};

export type CampaignReportDeps = {
  prisma: Db;
};

type ReportBookingRow = {
  attributionChannel: BookingSource;
  attributionCampaign: string | null;
  chargeAmountCents: number | null;
  totalPriceCents: number;
};

function groupKey(channel: BookingSource, campaign: string | null): string {
  return `${channel}::${campaign ?? ""}`;
}

export async function loadCampaignReport(
  deps: CampaignReportDeps,
): Promise<CampaignReport> {
  const bookings = (await deps.prisma.booking.findMany({
    where: { status: { in: COUNTED_STATUSES } },
    select: REPORT_SELECT,
  })) as ReportBookingRow[];

  const groups = new Map<string, CampaignReportRow>();
  let totalBookings = 0;
  let totalRevenueCents = 0;

  for (const b of bookings) {
    // What was actually paid; zero-charge rows (0) count as a booking with no
    // revenue. Legacy rows with a null charge fall back to the ledger price.
    const revenue = b.chargeAmountCents ?? b.totalPriceCents;
    const key = groupKey(b.attributionChannel, b.attributionCampaign);
    const existing = groups.get(key);
    if (existing) {
      existing.bookings += 1;
      existing.revenueCents += revenue;
    } else {
      groups.set(key, {
        channel: b.attributionChannel,
        campaign: b.attributionCampaign,
        label:
          campaignLabel(b.attributionCampaign) ??
          SOURCE_LABEL[b.attributionChannel],
        bookings: 1,
        revenueCents: revenue,
      });
    }
    totalBookings += 1;
    totalRevenueCents += revenue;
  }

  const rows = [...groups.values()].sort(
    (a, b) => b.revenueCents - a.revenueCents || b.bookings - a.bookings,
  );

  return { rows, totalBookings, totalRevenueCents };
}
