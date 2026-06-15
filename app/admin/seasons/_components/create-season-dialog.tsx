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

import { SeasonForm } from "./season-form";

export function CreateSeasonDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        data-testid="season-new"
        onClick={() => setOpen(true)}
      >
        New season
      </Button>
      <DialogContent data-testid="season-create-dialog">
        <DialogHeader>
          <DialogTitle>New season</DialogTitle>
          <DialogDescription>
            Create a winter season. It starts inactive — set prices, then
            activate it.
          </DialogDescription>
        </DialogHeader>
        <SeasonForm mode="create" onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
