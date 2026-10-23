import "server-only";

import { BookingSource, BookingStatus } from "@prisma/client";

import {
  campaignLabel,
  normalizeSource,
  sourceDisplay,
} from "@/lib/attribution/campaigns";
import { SOURCE_LABEL } from "@/lib/labels/booking";
import type { Db } from "@/lib/db";

// F-156: the campaign rollup for /admin/campaigns — bookings count + CHF revenue
// per (channel, campaign, source). Only CONFIRMED + COMPLETED bookings count as
// "a booking that happened" (PENDING, cancelled, failed and refunded excluded).
//
// The source is folded into the group key so a channel that lumps platforms
// together (SOCIAL covers Instagram + TikTok + Facebook) still splits into one
// row per platform in the rollup, without promoting each platform to a
// first-class BookingSource. `utm_source` variants are canonicalised
// (normalizeSource) so "ig"/"instagram" don't become two rows.
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
  utmSource: true,
  chargeAmountCents: true,
  totalPriceCents: true,
} as const;

export type CampaignReportRow = {
  channel: BookingSource;
  campaign: string | null;
  /** Canonical source token (e.g. "instagram") when the booking carried one. */
  source: string | null;
  /**
   * Display name: campaign label if tagged, else the channel label refined by
   * the source ("Social · Instagram"), else the channel's own label.
   */
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
  utmSource: string | null;
  chargeAmountCents: number | null;
  totalPriceCents: number;
};

function groupKey(
  channel: BookingSource,
  campaign: string | null,
  source: string | null,
): string {
  return `${channel}::${campaign ?? ""}::${source ?? ""}`;
}

/**
 * Campaign label wins; otherwise refine the channel label with the source
 * ("Social · Instagram") so platforms are legible; otherwise the channel label.
 */
function rowLabel(
  channel: BookingSource,
  campaign: string | null,
  source: string | null,
): string {
  const byCampaign = campaignLabel(campaign);
  if (byCampaign) return byCampaign;
  const platform = sourceDisplay(source);
  if (platform) return `${SOURCE_LABEL[channel]} · ${platform}`;
  return SOURCE_LABEL[channel];
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
    const source = normalizeSource(b.utmSource);
    const key = groupKey(b.attributionChannel, b.attributionCampaign, source);
    const existing = groups.get(key);
    if (existing) {
      existing.bookings += 1;
      existing.revenueCents += revenue;
    } else {
      groups.set(key, {
        channel: b.attributionChannel,
        campaign: b.attributionCampaign,
        source,
        label: rowLabel(b.attributionChannel, b.attributionCampaign, source),
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
