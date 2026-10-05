import type { Metadata } from "next";

import { listAnnouncementsWith } from "@/lib/admin/announcements";
import { prisma } from "@/lib/db";

import { AnnouncementRow } from "./_components/announcement-row";
import { CreateAnnouncementDialog } from "./_components/create-announcement-dialog";

export const metadata: Metadata = {
  title: "Announcements · Admin",
};

export default async function AdminAnnouncementsPage() {
  const banners = await listAnnouncementsWith({ prisma });
  const orderedIds = banners.map((b) => b.id);
  const enabledCount = banners.filter((b) => b.enabled).length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-input pb-8">
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
            Announcements
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Home banners
          </h1>
          <p className="text-sm text-muted-foreground">
            The band above the home hero. Enabled banners rotate every few
            seconds. While a promotion is live, at least one banner must stay
            enabled.
          </p>
        </div>
        <CreateAnnouncementDialog />
      </header>

      {enabledCount === 0 ? (
        <p
          data-testid="announcements-none-enabled"
          className="mt-6 border border-dashed border-input px-4 py-3 text-sm text-muted-foreground"
        >
          No enabled banners — the home page shows no announcement band, and a
          promotion cannot be saved until one is enabled.
        </p>
      ) : null}

      <section data-testid="announcements-list" className="mt-2">
        {banners.length === 0 ? (
          <p
            data-testid="announcements-empty"
            className="py-12 text-sm text-muted-foreground"
          >
            No banners yet. Create one to announce a promotion or seasonal note.
          </p>
        ) : (
          banners.map((row, index) => (
            <AnnouncementRow
              key={row.id}
              row={row}
              index={index}
              orderedIds={orderedIds}
            />
          ))
        )}
      </section>
    </div>
  );
}
