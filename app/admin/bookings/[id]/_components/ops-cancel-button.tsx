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

import { cancelBookingByOps } from "../../../actions";

type Props = {
  bookingId: string;
  /** Cash to refund via Stripe in the happy path. Server still gates on
   * `paidAt` + `stripePaymentIntentId`; this is for display. */
  cashRefundPreviewCents: number;
  /** Credit value the booking redeemed at checkout, re-emitted fresh as an
   * OPS_CANCEL credit. */
  creditReEmitPreviewCents: number;
};

const ERROR_COPY: Record<string, string> = {
  NOT_FOUND: "Booking is gone.",
  FORBIDDEN_STATUS:
    "This booking can no longer be ops-cancelled (already cancelled, refunded, or in a final state).",
};

export function OpsCancelButton({
  bookingId,
  cashRefundPreviewCents,
  creditReEmitPreviewCents,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setError(null);
      setReason("");
    }
  }

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await cancelBookingByOps({
        bookingId,
        reason: reason.trim() || undefined,
      });
      if (res.ok) {
        if (res.outcome === "already_cancelled") {
          toast.message("Already ops-cancelled.");
        } else if (res.outcome === "no_charge") {
          toast.success("Cancelled — nothing to refund (never paid).");
        } else {
          const parts: string[] = [];
          if (res.cashRefundedCents > 0)
            parts.push(`refund ${formatChf(res.cashRefundedCents)}`);
          if (res.creditReEmittedCents > 0)
            parts.push(`credit ${formatChf(res.creditReEmittedCents)}`);
          toast.success(`Cancelled · ${parts.join(" · ")}`);
        }
        setOpen(false);
        router.refresh();
        return;
      }
      setError(ERROR_COPY[res.error] ?? "Could not cancel the booking.");
    });
  }

  const hasCash = cashRefundPreviewCents > 0;
  const hasCredit = creditReEmitPreviewCents > 0;

  return (
    <>
      <Button
        type="button"
        data-testid="admin-detail-action-ops-cancel"
        onClick={() => onOpenChange(true)}
      >
        Cancel (ops refund)
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="ops-cancel-dialog">
          <DialogHeader>
            <DialogTitle>Cancel this booking on the school&apos;s side?</DialogTitle>
            <DialogDescription>
              Status flips to <strong>CANCELLED_BY_OPS</strong>. The booker is
              emailed the outcome and the slot is released.
            </DialogDescription>
          </DialogHeader>

          <ul
            className="space-y-2 border-y border-input py-3 text-sm"
            data-testid="ops-cancel-preview"
          >
            {hasCash ? (
              <li>
                Stripe refund:{" "}
                <strong data-testid="ops-cancel-preview-cash">
                  {formatChf(cashRefundPreviewCents)}
                </strong>
              </li>
            ) : null}
            {hasCredit ? (
              <li>
                Credit re-emit:{" "}
                <strong data-testid="ops-cancel-preview-credit">
                  {formatChf(creditReEmitPreviewCents)}
                </strong>{" "}
                (1 year from class start)
              </li>
            ) : null}
            {!hasCash && !hasCredit ? (
              <li data-testid="ops-cancel-preview-none">
                Nothing to refund (never paid). Slot just gets released.
              </li>
            ) : null}
          </ul>

          <div className="space-y-2">
            <label
              htmlFor="ops-cancel-reason"
              className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Reason (optional, internal audit)
            </label>
            <Textarea
              id="ops-cancel-reason"
              data-testid="ops-cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Weather · instructor sick · etc."
            />
          </div>

          {error ? (
            <p
              data-testid="ops-cancel-error"
              className="text-sm font-medium text-destructive"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-testid="ops-cancel-dialog-cancel"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Back
            </Button>
            <Button
              type="button"
              data-testid="ops-cancel-dialog-confirm"
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? "Cancelling…" : "Confirm cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
