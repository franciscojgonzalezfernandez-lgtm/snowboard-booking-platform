"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DiscountCodeListRow } from "@/lib/admin/discount-codes";
import { formatChf } from "@/lib/pricing/format";

import { setDiscountCodeActive } from "../../actions";
import { DiscountCodeForm } from "./discount-code-form";

export function DiscountCodeRow({ row }: { row: DiscountCodeListRow }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const valueLabel =
    row.percentOff != null
      ? `${row.percentOff}% off`
      : `${formatChf(row.amountOffCents ?? 0)} off`;
  const redemptionsLabel =
    row.maxRedemptions != null
      ? `${row.redemptionsUsed} / ${row.maxRedemptions}`
      : `${row.redemptionsUsed} · unlimited`;

  function onToggleActive() {
    startTransition(async () => {
      const res = await setDiscountCodeActive({ id: row.id, active: !row.active });
      if (res.ok) {
        toast.success(
          row.active ? `${row.code} deactivated.` : `${row.code} is now active.`,
        );
        router.refresh();
        return;
      }
      toast.error("Code not found — reload the page.");
    });
  }

  return (
    <article
      data-testid={`discount-row-${row.id}`}
      data-active={row.active}
      className="flex flex-col gap-4 border-b border-input py-6 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-xl tracking-tight tabular-nums">
            {row.code}
          </h3>
          {row.active ? (
            <span
              data-testid={`discount-badge-active-${row.id}`}
              className="border border-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]"
            >
              Active
            </span>
          ) : (
            <span
              data-testid={`discount-badge-inactive-${row.id}`}
              className="border border-input px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Inactive
            </span>
          )}
        </div>
        {row.label ? (
          <p className="text-sm text-muted-foreground">{row.label}</p>
        ) : null}
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <div className="flex gap-1.5">
            <dt>Discount:</dt>
            <dd data-testid={`discount-value-${row.id}`}>{valueLabel}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Redemptions:</dt>
            <dd
              className="tabular-nums"
              data-testid={`discount-redemptions-${row.id}`}
            >
              {redemptionsLabel}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`discount-edit-${row.id}`}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`discount-toggle-${row.id}`}
          onClick={onToggleActive}
          disabled={pending}
        >
          {row.active ? "Deactivate" : "Activate"}
        </Button>
      </div>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent data-testid={`discount-edit-dialog-${row.id}`}>
          <DialogHeader>
            <DialogTitle>Edit {row.code}</DialogTitle>
            <DialogDescription>
              Changes apply to new bookings only; bookings that already used this
              code keep the discount they got.
            </DialogDescription>
          </DialogHeader>
          <DiscountCodeForm
            mode="edit"
            codeId={row.id}
            defaults={{
              code: row.code,
              label: row.label ?? "",
              discountType: row.percentOff != null ? "percent" : "amount",
              percentOff: row.percentOff ?? undefined,
              amountFrancs:
                row.amountOffCents != null
                  ? row.amountOffCents / 100
                  : undefined,
              maxRedemptions: row.maxRedemptions ?? undefined,
              active: row.active,
            }}
            onDone={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </article>
  );
}
