"use client";

import { useState, useTransition } from "react";
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

import { deleteAvailabilityBlock } from "../../actions";

const ERROR_COPY: Record<string, string> = {
  NOT_FOUND: "Window is gone already.",
  FORBIDDEN: "Not yours to delete.",
  HAS_ACTIVE_BOOKINGS:
    "This window has a confirmed or pending booking. Cancel the booking first.",
};

type Props = {
  blockId: string;
  /** Server rejects deleting a window that overlaps an active booking; when
   * true we block the click up front so the modal never promises a delete the
   * guard will refuse. */
  hasActiveBooking: boolean;
};

export function DeleteBlockButton({ blockId, hasActiveBooking }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setError(null);
  }

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await deleteAvailabilityBlock(blockId);
      if (res.ok) {
        toast.success("Availability window deleted.");
        setOpen(false);
        return;
      }
      // Keep the dialog open and show why inline — a closing toast was too
      // easy to miss (the user saw "nothing happened").
      setError(ERROR_COPY[res.error] ?? "Could not delete the window.");
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid={`availability-delete-${blockId}`}
        onClick={() => onOpenChange(true)}
        disabled={hasActiveBooking}
        title={
          hasActiveBooking
            ? "Cancel the booking in this window before deleting it."
            : undefined
        }
      >
        Delete
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="availability-delete-dialog">
        <DialogHeader>
          <DialogTitle>Delete this availability window?</DialogTitle>
          <DialogDescription>
            Booking slots from this window stop being offered. A window with a
            confirmed or pending booking can&apos;t be deleted — cancel the
            booking first.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p
            data-testid="availability-delete-error"
            className="text-sm font-medium text-destructive"
          >
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-testid="availability-delete-cancel"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="availability-delete-confirm"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  );
}
