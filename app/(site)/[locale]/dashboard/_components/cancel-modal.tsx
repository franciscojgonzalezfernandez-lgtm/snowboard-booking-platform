"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OPERATIONAL_PHONE_DISPLAY } from "@/lib/contact/phone";
import { cancelBookingByUser } from "../actions";

type Props = {
  bookingId: string;
  /** Render-time hint for which policy copy to show. The server action is the
   * authority on credit vs forfeit; this only steers the modal wording. */
  earnsCredit: boolean;
  /** Pre-formatted CHF label of the credit the booker would receive. */
  creditAmountLabel: string;
  /** F-157: Duration enum of this booking, fed to the reschedule funnel as `d`. */
  rescheduleDuration: string;
  /** F-157: whether "Move lesson" is offered (upcoming, ≥48h out, in horizon).
   * The reschedule funnel + server action re-check all of this. */
  canReschedule: boolean;
  /** F-157: why Move is disabled, when it is — drives the muted sub-label. */
  rescheduleBlockedReason?: "too_late" | "horizon";
};

export function CancelModal({
  bookingId,
  earnsCredit,
  creditAmountLabel,
  rescheduleDuration,
  canReschedule,
  rescheduleBlockedReason,
}: Props) {
  const t = useTranslations("dashboard.cancel");
  const tr = useTranslations("dashboard.reschedule");
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await cancelBookingByUser(bookingId);
      if (result.ok) {
        setDialogOpen(false);
        toast.success(t("toast_success"));
        router.refresh();
        return;
      }
      if (result.error === "ALREADY_CANCELLED") {
        setDialogOpen(false);
        toast.error(t("error_already_cancelled"));
        router.refresh();
        return;
      }
      toast.error(t("error_generic"));
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid="dashboard-booking-actions"
          aria-label={t("actions_label")}
          render={
            <Button type="button" variant="ghost" size="icon" />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canReschedule ? (
            <DropdownMenuItem
              data-testid="dashboard-booking-reschedule-trigger"
              render={
                <Link
                  href={{
                    pathname: "/reservar",
                    query: { reschedule: bookingId, d: rescheduleDuration },
                  }}
                />
              }
            >
              {tr("button")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              data-testid="dashboard-booking-reschedule-disabled"
              disabled
              className="flex-col items-start gap-0.5"
            >
              <span>{tr("button")}</span>
              {rescheduleBlockedReason ? (
                <span className="text-xs text-muted-foreground">
                  {rescheduleBlockedReason === "too_late"
                    ? tr("disabled_too_late")
                    : tr("disabled_horizon")}
                </span>
              ) : null}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            data-testid="dashboard-booking-cancel-trigger"
            onClick={() => setDialogOpen(true)}
          >
            {t("button")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="cancel-dialog">
          <DialogHeader>
            <DialogTitle>{t("modal_title")}</DialogTitle>
            <DialogDescription data-testid="cancel-dialog-body">
              {earnsCredit
                ? t("body_credit", { amount: creditAmountLabel })
                : t("body_forfeit", { phone: OPERATIONAL_PHONE_DISPLAY })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-testid="cancel-dialog-dismiss"
              onClick={() => setDialogOpen(false)}
              disabled={pending}
            >
              {t("dismiss")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-testid="cancel-dialog-confirm"
              onClick={handleConfirm}
              disabled={pending}
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
