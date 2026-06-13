import type { Metadata } from "next";
import { Duration } from "@prisma/client";

import { getActiveSeasonPricingWith } from "@/lib/admin/pricing";
import { DURATION_LABEL } from "@/lib/labels/booking";
import { prisma } from "@/lib/db";
import { centsToFrancs } from "@/lib/pricing/chf";
import { formatChf } from "@/lib/pricing/format";

import { PricingForm } from "./_components/pricing-form";

export const metadata: Metadata = {
  title: "Pricing · Admin",
};

const DURATION_ORDER: Duration[] = [
  Duration.ONE_HOUR,
  Duration.TWO_HOURS,
  Duration.INTENSIVE,
  Duration.FULL_DAY,
];

export default async function AdminPricingPage() {
  const result = await getActiveSeasonPricingWith({ prisma });

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="space-y-3 border-b border-input pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
            Pricing
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Lesson pricing
          </h1>
        </header>
        <p
          data-testid="pricing-no-season"
          className="py-8 text-sm text-muted-foreground"
        >
          No active season. Activate a season before setting prices.
        </p>
      </div>
    );
  }

  const { pricing } = result;

  // Build the form defaults (francs for display) + a labelled summary the page
  // header renders as the current state.
  const fields = DURATION_ORDER.map((duration) => {
    const cents = pricing.priceCentsByDuration[duration];
    return {
      duration,
      label: DURATION_LABEL[duration],
      cents,
      francs: cents === null ? null : centsToFrancs(cents),
      formatted: cents === null ? "—" : formatChf(cents),
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="space-y-3 border-b border-input pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
          Pricing · {pricing.seasonName}
        </p>
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
          Lesson pricing
        </h1>
        <p className="text-sm text-muted-foreground">
          Set the price per lesson length for the active season. Prices are in
          CHF and apply to new bookings immediately.
        </p>
      </header>

      <section className="space-y-5 border-b border-input py-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Current prices
        </h2>
        <dl
          data-testid="pricing-current"
          className="grid gap-3 sm:grid-cols-2"
        >
          {fields.map((f) => (
            <div
              key={f.duration}
              className="flex items-baseline justify-between gap-4 border-b border-input/60 pb-2"
            >
              <dt className="text-sm text-muted-foreground">{f.label}</dt>
              <dd
                data-testid={`pricing-current-${f.duration}`}
                className="font-display text-lg tabular-nums"
              >
                {f.formatted}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-5 py-8">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Edit prices
        </h2>
        <PricingForm
          fields={fields.map((f) => ({
            duration: f.duration,
            label: f.label,
            francs: f.francs,
          }))}
        />
      </section>
    </div>
  );
}
