import type { Metadata } from "next";

import {
  loadCampaignReport,
  type CampaignReportDeps,
} from "@/lib/admin/campaign-report";
import { SOURCE_LABEL } from "@/lib/labels/booking";
import { prisma } from "@/lib/db";
import { formatChf } from "@/lib/pricing/format";

function reportDeps(): CampaignReportDeps {
  return { prisma };
}

export const metadata: Metadata = {
  title: "Campaigns · Admin",
};

export default async function AdminCampaignsPage() {
  const report = await loadCampaignReport(reportDeps());

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Marketing
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          Campaigns
        </h1>
        <p className="text-sm text-muted-foreground">
          Confirmed and completed bookings grouped by acquisition source. Revenue
          is what was actually charged. Direct is untagged traffic.
        </p>
      </header>

      <section className="space-y-6 py-8">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-input p-5">
            <dt className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Total bookings
            </dt>
            <dd
              className="mt-2 font-display text-3xl tabular-nums"
              data-testid="admin-campaigns-total-bookings"
            >
              {report.totalBookings}
            </dd>
          </div>
          <div className="rounded-lg border border-input p-5">
            <dt className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Total revenue
            </dt>
            <dd
              className="mt-2 font-display text-3xl tabular-nums"
              data-testid="admin-campaigns-total-revenue"
            >
              {formatChf(report.totalRevenueCents)}
            </dd>
          </div>
        </dl>

        <div className="overflow-hidden rounded-lg border border-input">
          <div
            className="hidden border-b border-input bg-card/50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground sm:grid sm:grid-cols-[1fr,12rem,7rem,8rem] sm:gap-3"
            aria-hidden
          >
            <span>Campaign</span>
            <span>Channel</span>
            <span className="text-right">Bookings</span>
            <span className="text-right">Revenue</span>
          </div>

          {report.rows.length === 0 ? (
            <p
              className="px-4 py-12 text-center text-sm text-muted-foreground"
              data-testid="admin-campaigns-empty"
            >
              No bookings yet.
            </p>
          ) : (
            <ul data-testid="admin-campaigns-list">
              {report.rows.map((row) => (
                <li
                  key={`${row.channel}:${row.campaign ?? ""}`}
                  data-testid="admin-campaign-row"
                  data-channel={row.channel}
                  className="grid gap-3 border-b border-input px-4 py-4 last:border-0 sm:grid-cols-[1fr,12rem,7rem,8rem] sm:items-baseline"
                >
                  <span className="min-w-0 truncate font-medium">
                    {row.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {SOURCE_LABEL[row.channel]}
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    {row.bookings}
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    {formatChf(row.revenueCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
