"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cancelBookingByUser } from "../actions";

// F-052 (Sprint 5) lifts this to lib/contact/phone.ts and replaces all usages;
// until then it lives where it is consumed. Locale-independent on purpose.
const CONTACT_PHONE = "+41 76 638 18 70";

type Props = {
  bookingId: string;
  /** Render-time hint for which policy copy to show. The server action is the
   * authority on credit vs forfeit; this only steers the modal wording. */
  earnsCredit: boolean;
  /** Pre-formatted CHF label of the credit the booker would receive. */
  creditAmountLabel: string;
};

export function CancelModal({ bookingId, earnsCredit, creditAmountLabel }: Props) {
  const t = useTranslations("dashboard.cancel");
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
                : t("body_forfeit", { phone: CONTACT_PHONE })}
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
