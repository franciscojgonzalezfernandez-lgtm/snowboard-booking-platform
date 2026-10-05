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
import type { AdminAnnouncementRow } from "@/lib/admin/announcements";

import {
  deleteAnnouncement,
  reorderAnnouncements,
  setAnnouncementEnabled,
} from "../../actions";
import { AnnouncementForm } from "./announcement-form";

const ERROR_COPY: Record<string, string> = {
  NOT_FOUND: "Banner not found — reload the page.",
  BANNER_REQUIRED_BY_PROMO:
    "A promotion is live — keep at least one banner enabled, or disable the promo first.",
};

export function AnnouncementRow({
  row,
  index,
  orderedIds,
}: {
  row: AdminAnnouncementRow;
  index: number;
  orderedIds: string[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const total = orderedIds.length;
  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;

  function onToggle() {
    startTransition(async () => {
      const res = await setAnnouncementEnabled({
        id: row.id,
        enabled: !row.enabled,
      });
      if (res.ok) {
        toast.success(row.enabled ? "Banner hidden." : "Banner shown.");
        router.refresh();
        return;
      }
      toast.error(ERROR_COPY[res.error] ?? "Could not update the banner.");
    });
  }

  function onMove(direction: -1 | 1) {
    const next = [...orderedIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const current = next[index];
    const swapped = next[target];
    if (current === undefined || swapped === undefined) return;
    next[index] = swapped;
    next[target] = current;
    startTransition(async () => {
      const res = await reorderAnnouncements({ orderedIds: next });
      if (res.ok) {
        router.refresh();
        return;
      }
      toast.error("Could not reorder — reload the page.");
    });
  }

  function onDelete() {
    startTransition(async () => {
      const res = await deleteAnnouncement({ id: row.id });
      if (res.ok) {
        toast.success("Banner deleted.");
        setDeleteOpen(false);
        router.refresh();
        return;
      }
      toast.error(ERROR_COPY[res.error] ?? "Could not delete the banner.");
    });
  }

  return (
    <article
      data-testid={`announcement-row-${row.id}`}
      data-enabled={row.enabled}
      className="flex flex-col gap-4 border-b border-input py-6 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-3">
          <p className="truncate font-medium">{row.body.en || "—"}</p>
          {row.enabled ? (
            <span
              data-testid={`announcement-badge-enabled-${row.id}`}
              className="shrink-0 border border-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]"
            >
              On
            </span>
          ) : (
            <span
              data-testid={`announcement-badge-disabled-${row.id}`}
              className="shrink-0 border border-muted-foreground/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Off
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          DE: {row.body.de || "—"} · ES: {row.body.es || "—"}
          {row.ctaHref ? ` · CTA → ${row.ctaHref}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`announcement-move-up-${row.id}`}
          disabled={!canMoveUp || pending}
          onClick={() => onMove(-1)}
          aria-label="Move up"
        >
          ↑
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`announcement-move-down-${row.id}`}
          disabled={!canMoveDown || pending}
          onClick={() => onMove(1)}
          aria-label="Move down"
        >
          ↓
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`announcement-toggle-${row.id}`}
          disabled={pending}
          onClick={onToggle}
        >
          {row.enabled ? "Disable" : "Enable"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`announcement-edit-${row.id}`}
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`announcement-delete-${row.id}`}
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </Button>
      </div>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          data-testid={`announcement-edit-dialog-${row.id}`}
          className="max-h-[85vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>Edit banner</DialogTitle>
            <DialogDescription>
              Changes appear on the home page immediately after saving.
            </DialogDescription>
          </DialogHeader>
          <AnnouncementForm
            mode="edit"
            bannerId={row.id}
            defaults={{
              body: row.body,
              ctaLabel: row.ctaLabel ?? { en: "", de: "", es: "" },
              ctaHref: row.ctaHref ?? "",
              enabled: row.enabled,
            }}
            onDone={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent data-testid={`announcement-delete-dialog-${row.id}`}>
          <DialogHeader>
            <DialogTitle>Delete this banner?</DialogTitle>
            <DialogDescription>
              This can’t be undone. If a promotion is live, at least one banner
              must stay enabled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={pending}
            >
              Back
            </Button>
            <Button
              type="button"
              data-testid={`announcement-delete-confirm-${row.id}`}
              onClick={onDelete}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
