"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { AnnouncementForm } from "./announcement-form";

export function CreateAnnouncementDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        data-testid="announcement-new"
        onClick={() => setOpen(true)}
      >
        New banner
      </Button>
      <DialogContent
        data-testid="announcement-create-dialog"
        className="max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>New banner</DialogTitle>
          <DialogDescription>
            Owner-authored announcement shown above the home hero. Multiple
            enabled banners rotate every few seconds.
          </DialogDescription>
        </DialogHeader>
        <AnnouncementForm mode="create" onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
