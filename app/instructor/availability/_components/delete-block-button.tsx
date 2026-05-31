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
};

export function DeleteBlockButton({ blockId }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const res = await deleteAvailabilityBlock(blockId);
      if (res.ok) {
        toast.success("Availability window deleted.");
        setOpen(false);
        return;
      }
      toast.error(ERROR_COPY[res.error] ?? "Could not delete the window.");
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid={`availability-delete-${blockId}`}
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="availability-delete-dialog">
        <DialogHeader>
          <DialogTitle>Delete this availability window?</DialogTitle>
          <DialogDescription>
            Booking slots that depended on this window stop being offered. Past
            bookings inside the window are not affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            data-testid="availability-delete-cancel"
            onClick={() => setOpen(false)}
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
