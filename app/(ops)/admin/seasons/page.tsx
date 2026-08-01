import type { Metadata } from "next";

import { listSeasonsWith } from "@/lib/admin/seasons";
import { prisma } from "@/lib/db";

import { CreateSeasonDialog } from "./_components/create-season-dialog";
import { SeasonRow } from "./_components/season-row";

export const metadata: Metadata = {
  title: "Seasons · Admin",
};

export default async function AdminSeasonsPage() {
  const seasons = await listSeasonsWith({ prisma });
  const hasActive = seasons.some((s) => s.active);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-input pb-8">
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
            Seasons
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Seasons
          </h1>
          <p className="text-sm text-muted-foreground">
            Create, edit and activate winter seasons. Exactly one season is
            active at a time; it drives pricing, availability and the booking
            funnel.
          </p>
        </div>
        <CreateSeasonDialog />
      </header>

      {!hasActive ? (
        <p
          data-testid="seasons-no-active"
          className="mt-6 border border-dashed border-input px-4 py-3 text-sm text-muted-foreground"
        >
          No active season. Activate one below so pricing and bookings work.
        </p>
      ) : null}

      <section data-testid="seasons-list" className="mt-2">
        {seasons.length === 0 ? (
          <p
            data-testid="seasons-empty"
            className="py-12 text-sm text-muted-foreground"
          >
            No seasons yet. Create the first one to start taking bookings.
          </p>
        ) : (
          seasons.map((row) => <SeasonRow key={row.id} row={row} />)
        )}
      </section>
    </div>
  );
}
