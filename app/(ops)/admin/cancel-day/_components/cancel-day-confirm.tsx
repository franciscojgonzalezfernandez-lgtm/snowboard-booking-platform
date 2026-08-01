"use client";

import { useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { formatChf } from "@/lib/pricing/format";

import { cancelDayByOps } from "../../actions";

type Props = {
  date: string;
  instructorId: string | null;
  bookingsCount: number;
};

const ERROR_COPY: Record<string, string> = {
  NOT_FOUND: "Booking is gone.",
  FORBIDDEN_STATUS: "Already in a final state.",
  UNCAUGHT: "Unexpected failure.",
};

export function CancelDayConfirm({
  date,
  instructorId,
  bookingsCount,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setReason("");
  }

  function onConfirm() {
    startTransition(async () => {
      const res = await cancelDayByOps({
        date,
        instructorId: instructorId ?? undefined,
        reason: reason.trim() || undefined,
      });

      if (!res.ok) {
        toast.error("Could not start the batch — input rejected.");
        return;
      }

      const { totals, results } = res;
      if (totals.failed === 0) {
        toast.success(
          `Cancelled ${totals.succeeded + totals.alreadyCancelled} of ${
            totals.attempted
          } · refund ${formatChf(
            totals.cashRefundedCents,
          )} · credit ${formatChf(totals.creditReEmittedCents)}`,
        );
      } else {
        const failedRows = results.filter((r) => !r.ok);
        const sample = failedRows
          .slice(0, 3)
          .map(
            (r) =>
              `${r.bookingId.slice(0, 6)}…: ${ERROR_COPY[(r as { error: string }).error] ?? (r as { error: string }).error}`,
          )
          .join("\n");
        toast.error(
          `Partial: ${totals.succeeded} ok, ${totals.failed} failed.\n${sample}${
            failedRows.length > 3 ? "\n…" : ""
          }`,
        );
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-t border-input pt-6">
        <Button
          type="button"
          data-testid="cancel-day-open-confirm"
          onClick={() => onOpenChange(true)}
        >
          Cancel {bookingsCount}{" "}
          {bookingsCount === 1 ? "booking" : "bookings"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Bookers are emailed individually. The action is idempotent — re-run
          safely if some rows fail.
        </p>
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="cancel-day-dialog">
          <DialogHeader>
            <DialogTitle>Cancel the entire day?</DialogTitle>
            <DialogDescription>
              {bookingsCount} {bookingsCount === 1 ? "booking" : "bookings"} on{" "}
              {date} will be flipped to <strong>CANCELLED_BY_OPS</strong>. Cash
              refunds + credit re-emits happen per booking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="cancel-day-reason"
              className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Reason (optional — shown to every booker)
            </label>
            <Textarea
              id="cancel-day-reason"
              data-testid="cancel-day-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Avalanche risk · piste closed · etc."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-testid="cancel-day-dialog-cancel"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Back
            </Button>
            <Button
              type="button"
              data-testid="cancel-day-dialog-confirm"
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? "Cancelling…" : "Confirm batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
