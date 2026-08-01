"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SeasonListRow } from "@/lib/admin/seasons";

import { activateSeason, deactivateSeason } from "../../actions";
import { SeasonForm } from "./season-form";

const ACTIVATE_ERROR_COPY: Record<string, string> = {
  NOT_FOUND: "Season not found — reload the page.",
  INCOMPLETE_PRICING:
    "Set all four lesson prices before activating this season.",
};

export function SeasonRow({ row }: { row: SeasonListRow }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onActivate() {
    startTransition(async () => {
      const res = await activateSeason({ id: row.id });
      if (res.ok) {
        toast.success(`${row.name} is now the active season.`);
        setActivateOpen(false);
        router.refresh();
        return;
      }
      toast.error(ACTIVATE_ERROR_COPY[res.error] ?? "Could not activate.");
    });
  }

  function onDeactivate() {
    startTransition(async () => {
      const res = await deactivateSeason({ id: row.id });
      if (res.ok) {
        toast.success(`${row.name} deactivated.`);
        setDeactivateOpen(false);
        router.refresh();
        return;
      }
      toast.error("Season not found — reload the page.");
    });
  }

  return (
    <article
      data-testid={`season-row-${row.id}`}
      data-active={row.active}
      className="flex flex-col gap-4 border-b border-input py-6 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-xl tracking-tight">{row.name}</h3>
          {row.active ? (
            <span
              data-testid={`season-badge-active-${row.id}`}
              className="border border-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]"
            >
              Active
            </span>
          ) : null}
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <div className="flex gap-1.5">
            <dt className="sr-only">Dates</dt>
            <dd className="tabular-nums">
              {row.startDate} → {row.endDate}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Anchors:</dt>
            <dd className="tabular-nums">{row.anchorTimes.join(", ")}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Hours:</dt>
            <dd className="tabular-nums">
              {row.operatingHoursStart}–{row.operatingHoursEnd}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Pricing:</dt>
            <dd
              data-testid={`season-pricing-${row.id}`}
              className={row.pricingComplete ? "" : "text-destructive"}
            >
              {row.pricingComplete ? "Complete" : "Incomplete"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`season-edit-${row.id}`}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
        {row.active ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid={`season-deactivate-${row.id}`}
            onClick={() => setDeactivateOpen(true)}
          >
            Deactivate
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            data-testid={`season-activate-${row.id}`}
            onClick={() => setActivateOpen(true)}
          >
            Activate
          </Button>
        )}
      </div>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent data-testid={`season-edit-dialog-${row.id}`}>
          <DialogHeader>
            <DialogTitle>Edit {row.name}</DialogTitle>
            <DialogDescription>
              Dates and anchors can’t drop confirmed or pending bookings.
            </DialogDescription>
          </DialogHeader>
          <SeasonForm
            mode="edit"
            seasonId={row.id}
            defaults={{
              name: row.name,
              startDate: row.startDate,
              endDate: row.endDate,
              anchorTimes: row.anchorTimes,
              operatingHoursStart: row.operatingHoursStart,
              operatingHoursEnd: row.operatingHoursEnd,
            }}
            onDone={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Activate */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent data-testid={`season-activate-dialog-${row.id}`}>
          <DialogHeader>
            <DialogTitle>Activate {row.name}?</DialogTitle>
            <DialogDescription>
              This becomes the one active season; any other active season is
              deactivated. Pricing and availability follow the active season.
            </DialogDescription>
          </DialogHeader>
          {!row.pricingComplete ? (
            <p
              data-testid={`season-activate-warning-${row.id}`}
              className="text-sm text-destructive"
            >
              Pricing is incomplete. Set all four lesson prices in{" "}
              <Link href="/admin/pricing" className="underline">
                Pricing
              </Link>{" "}
              first.
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setActivateOpen(false)}
              disabled={pending}
            >
              Back
            </Button>
            <Button
              type="button"
              data-testid={`season-activate-confirm-${row.id}`}
              onClick={onActivate}
              disabled={pending}
            >
              {pending ? "Activating…" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent data-testid={`season-deactivate-dialog-${row.id}`}>
          <DialogHeader>
            <DialogTitle>Deactivate {row.name}?</DialogTitle>
            <DialogDescription>
              With no active season the booking funnel shows “out of season”.
              You can activate another season at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeactivateOpen(false)}
              disabled={pending}
            >
              Back
            </Button>
            <Button
              type="button"
              data-testid={`season-deactivate-confirm-${row.id}`}
              onClick={onDeactivate}
              disabled={pending}
            >
              {pending ? "Deactivating…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
