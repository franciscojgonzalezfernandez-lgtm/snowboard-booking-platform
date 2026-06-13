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
import type { MarkNoShowResult } from "@/lib/booking/mark-no-show";

const ERROR_COPY: Record<string, string> = {
  NOT_FOUND: "Booking is gone.",
  FORBIDDEN: "You can only mark your own classes.",
  NOT_AUTO_COMPLETED:
    "This booking is no longer an auto-completed class (already changed). Refreshing.",
};

type Props = {
  bookingId: string;
  /**
   * The surface's own `markNoShow` Server Action — admin passes
   * `app/admin/actions`, the instructor agenda passes `app/instructor/actions`.
   * Both wrap the same core and return {@link MarkNoShowResult}.
   */
  action: (input: { bookingId: string }) => Promise<MarkNoShowResult>;
  size?: "default" | "sm";
};

/**
 * F-081: re-flip an auto-completed booking to a no-show (CANCELLED_BY_USER, no
 * credit). Only rendered by the host when `autoCompletedAt != null`; the action
 * re-checks role + ownership + status server-side. A confirm dialog guards the
 * (forfeit) flip; on success the row's status changes after `router.refresh()`.
 */
export function NoShowButton({ bookingId, action, size = "default" }: Props) {
  const router = useRouter();
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
      const res = await action({ bookingId });
      if (res.ok) {
        toast.success("Marked as no-show.");
        setOpen(false);
        router.refresh();
        return;
      }
      setError(ERROR_COPY[res.error] ?? "Could not mark this booking.");
      if (res.error === "NOT_AUTO_COMPLETED" || res.error === "NOT_FOUND") {
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        data-testid="no-show-button"
        onClick={() => onOpenChange(true)}
      >
        Mark no-show
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="no-show-dialog">
          <DialogHeader>
            <DialogTitle>Mark this class as a no-show?</DialogTitle>
            <DialogDescription>
              Status flips to <strong>CANCELLED_BY_USER</strong> as of the class
              start time. This is a forfeit — <strong>no credit</strong> is
              issued. Use this only when the student did not show up.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p
              data-testid="no-show-error"
              className="text-sm font-medium text-destructive"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-testid="no-show-dialog-cancel"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-testid="no-show-dialog-confirm"
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? "Marking…" : "Confirm no-show"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
